# -*- coding: utf-8 -*-
"""
墨吟阅读器 · 免费离线神经语音服务
=====================================
只依赖 Python 标准库，不联网、不收费、没有账号和 API Key。
在本机 127.0.0.1 监听，调用同目录下的 sherpa-onnx 引擎 + 开源中文模型合成 WAV。
内置 11 个音色（10 个中文女声 + 1 个男声），全部来自同一份
AISHELL3 中文多说话人 VITS 模型，靠 --sid 切换声线。

接口：
  GET  /health            -> 引擎/模型状态（JSON，含每个音色是否就绪）
  POST /tts               -> {"text":"...","voice":"s12","speed":1.0} => audio/wav
  OPTIONS *               -> CORS 预检（供 file:// 双击打开的页面调用）

关掉本窗口即停止服务。阅读器在没有服务时会自动用系统语音，不影响看书。
"""
import array
import io
import json
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import wave
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# 男声降噪（可选）。numpy 缺失或模块损坏时静默禁用，绝不能影响朗读本身。
try:
    import denoise as _dn
except Exception:
    _dn = None

# 源码运行时取脚本目录；PyInstaller 打成 MoYinVoice.exe 后取 exe 所在目录
# （engine/ 与 models/ 就在 exe 旁边，_MEIPASS 里没有这些大文件）。
def _here():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


HERE = os.environ.get('MOYIN_VOICE_ROOT') or _here()
PORT = next((int(a) for a in sys.argv[1:] if a.isdigit()), 8177)

ENGINE_DIR = os.path.join(HERE, 'engine')
MODEL_DIR = os.path.join(HERE, 'models')

# 引擎是 C++ 程序，读不了含中文的路径参数。项目若被拷到中文目录，
# 就把必要文件镜像一份到纯 ASCII 的临时目录再调用（只做一次）。
if not HERE.isascii():
    _mirror = os.path.join(os.environ.get('SystemDrive', 'C:') + os.sep,
                           'ProgramData', 'MoYinTTS')
    if not _mirror.isascii():
        _mirror = os.path.join(tempfile.gettempdir(), 'MoYinTTS')
    try:
        for sub in ('engine', 'models'):
            src = os.path.join(HERE, sub)
            if not os.path.isdir(src):
                continue
            for root, _dirs, files in os.walk(src):
                rel = os.path.relpath(root, src)
                dst = os.path.join(_mirror, sub, '' if rel == '.' else rel)
                os.makedirs(dst, exist_ok=True)
                for f in files:
                    a, b = os.path.join(root, f), os.path.join(dst, f)
                    if not os.path.isfile(b) or os.path.getsize(a) != os.path.getsize(b):
                        shutil.copy2(a, b)
        if os.path.isdir(os.path.join(_mirror, 'engine')):
            ENGINE_DIR = os.path.join(_mirror, 'engine')
            MODEL_DIR = os.path.join(_mirror, 'models')
    except OSError:
        pass
# ---------------- 引擎 ----------------
#
# ⚠️ 1.14.40 起成品只带 fanchen 一份。下面 xiaoya / chaowen / matcha 三段是
#    **向后兼容路径**：盘里还留着这些目录的老 VoicePack 照样认、照样注册成声线，
#    目录不在就静默跳过（不报错、不影响 187 人库）。安装器已不再下载它们——
#    xiao_ya 的训练语料 BZNSYP 明写「仅限非商用」。详见仓库根目录 VOICE-POLICY.md。
#
# xiaoya（老包女主）：Piper 中文单说话人 VITS，22.05 kHz。装的是官方 int8 版：
#   17.8 MB，而 fp32 原版 60.3 MB 且几乎压不动（进 APK 就是 60.3 MB）。代价是
#   合成慢 2.5 倍，谱质心 893→841 Hz、4 kHz 以上 2.9%→2.7%，听不出损失。
#
# chaowen（男主）：同架构中文男声，22.05 kHz，同为官方 int8，17.8 MB。与小雅
#   共用一套词典和数字规则——两者的 lexicon.txt、tokens.txt、三个 fst 逐字节
#   相同（2026-11-08 比对 md5 一致），所以只放一份在 models/shared。
#
# fanchen（配角库）：16 kHz 多说话人 VITS，38 MB 官方 int8。187 个说话人共用
#   一份模型，只靠 --sid 切声线，体积不随音色数量增长。自带词典与 jieba 分词
#   表，多音字读法更准。推理慢约 10 倍，所以只当配角。
#
# 男女分界（重要）：按音高 195 Hz 分，男声 37 / 女声 150。这个口径是用户逐条
#   试听校出来的。不要用说话人嵌入 emb_g 判性别——它编码的是音色类别，195 Hz
#   以上那批样本与边界差的中位只有 0.03（正常样本 0.30），用它分类会把成批
#   女声判成男声，2026-11-08 已经踩过一次。
#
# matcha（保留，可回退）：flow-matching 中文模型 + hifigan_v2 声码器，22.05 kHz，
#   韵律最自然，但 77 MB 且只有一个女声。把模型放回 models/matcha 即启用。
MATCHA_DIR = 'matcha'
MATCHA_MODEL = 'model-steps-3.onnx'
MATCHA_VOCODER = 'hifigan_v2.onnx'
MATCHA_F0 = 245                        # 离线实测中位基频，用于分档显示

# 小雅与超文共用的词表与数字规则，单独放 shared，省下一份重复的 2 MB。
SHARED_DIR = 'shared'
SHARED_FSTS = ['date.fst', 'number.fst', 'phone.fst']

XIAOYA_DIR = 'xiaoya'                  # 女主，模型文件统一叫 model.onnx
XIAOYA_F0 = 266                        # 2026-11-08 实测中位
CHAOWEN_DIR = 'chaowen'                # 男主
CHAOWEN_F0 = 163                       # 2026-11-08 实测中位
FANCHEN_DIR = 'fanchen'                # 187 人配角库

# 英文模型（可选装）。三个中文模型一个英文字母都不认识——实测 lexicon 里
# 连 hello / CPU / OK 都没有，送进去就是「一个字都没念出来」，整句 500。
# 所以小说里夹的 iPhone / WiFi / GDP 以前是被静默吞掉的，纯英文段落更是
# 直接报错。装一个英文模型（约 40 MB）就能把这块补上：
#   models/en-ljs/model.onnx + tokens.txt + lexicon.txt
#
# 用的是 icefall 的 vits-ljs（LJSpeech，22.05 kHz），靠自己的音素词典发音，
# **不需要 espeak**。这一点很关键：piper 系英文模型（en_US-lessac 之类）都要
# espeak-ng 前端，而 sherpa-onnx 2.0.1 的 Windows 包已经把 espeak 编掉了
# （2026-11-10 实测：二进制里搜不到 espeak_Initialize，任何 piper 模型都报
#  「no lexicon, and no frontend available」）。espeak-ng 是 GPLv3，不编进去
#  对许可证反而更干净——我们用 Apache-2.0 的 icefall 模型，正好对得上。
#
# 没装也不影响中文朗读，页面会拿系统英文语音顶这一段（见 app.js 的 speakForeign）。
EN_DIR = 'en-ljs'
EN_SID = 0                             # 多说话人模型里挑的那个英文声线
EN_F0 = 200                            # 只用于界面显示分档
EN_SR = 22050                          # vits-ljs 就是按 22.05 kHz 训的

SID_F0 = {
      0: 260,
      1: 278,
      2: 273,
      3: 251,
      4: 226,
      5: 286,
      6: 243,
      7: 224,
      8: 278,
      9: 234,
     10: 151,
     11: 238,
     12: 243,
     13: 217,
     14: 299,
     15: 153,
     16: 254,
     17: 288,
     18: 252,
     19: 232,
     20: 265,
     21: 172,
     22: 257,
     23: 205,
     24: 249,
     25: 152,
     26: 273,
     27: 218,
     28: 265,
     29: 201,
     30: 250,
     31: 276,
     32: 189,
     33: 303,
     34: 283,
     35: 252,
     36: 204,
     37: 247,
     38: 219,
     39: 291,
     40: 139,
     41: 251,
     42: 314,
     43: 314,
     44: 313,
     45: 275,
     46: 153,
     47: 223,
     48: 194,
     49: 276,
     50: 280,
     51: 249,
     52: 168,
     53: 290,
     54: 251,
     55: 247,
     56: 237,
     57: 219,
     58: 146,
     59: 220,
     60: 146,
     61: 260,
     62: 244,
     63: 258,
     64: 270,
     65: 175,
     66: 303,
     67: 286,
     68: 269,
     69: 128,
     70: 275,
     71: 268,
     72: 192,
     73: 279,
     74: 121,
     75: 181,
     76: 167,
     77: 246,
     78: 256,
     79: 244,
     80: 218,
     81: 240,
     82: 245,
     83: 194,
     84: 239,
     85: 263,
     86: 299,
     87: 272,
     88: 224,
     89: 256,
     90: 247,
     91: 243,
     92: 293,
     93: 231,
     94: 220,
     95: 172,
     96: 218,
     97: 295,
     98: 161,
     99: 272,
    100: 138,
    101: 257,
    102: 174,
    103: 262,
    104: 236,
    105: 316,
    106: 222,
    107: 164,
    108: 268,
    109: 256,
    110: 169,
    111: 277,
    112: 248,
    113: 232,
    114: 234,
    115: 251,
    116: 300,
    117: 241,
    118: 287,
    119: 131,
    120: 256,
    121: 298,
    122: 257,
    123: 256,
    124: 118,
    125: 278,
    126: 270,
    127: 283,
    128: 260,
    129: 249,
    130: 263,
    131: 226,
    132: 249,
    133: 257,
    134: 288,
    135: 280,
    136: 134,
    137: 256,
    138: 236,
    139: 280,
    140: 219,
    141: 283,
    142: 254,
    143: 163,
    144: 211,
    145: 273,
    146: 245,
    147: 236,
    148: 191,
    149: 220,
    150: 282,
    151: 176,
    152: 275,
    153: 153,
    154: 256,
    155: 260,
    156: 160,
    157: 279,
    158: 244,
    159: 271,
    160: 257,
    161: 254,
    162: 220,
    163: 150,
    164: 251,
    165: 238,
    166: 272,
    167: 162,
    168: 262,
    169: 213,
    170: 259,
    171: 176,
    172: 263,
    173: 277,
    174: 182,
    175: 154,
    176: 213,
    177: 198,
    178: 239,
    179: 280,
    180: 256,
    181: 168,
    182: 291,
    183: 169,
    184: 248,
    185: 266,
    186: 229,
}

# 桌面端精选 50 条（2026-11-13 由 30 扩到 50）。
#
# 为什么桌面能放 50 条、手机还是 30 条：桌面端把 fanchen 那套 187 人也放进了
# 常驻引擎（见 _probe_resident），每句实测 0.9 秒，跟 22 kHz 主角一样快；
# 安卓端走的是另一套 JNI 桥，同时加载 50 条没必要，30 条够用。
#
# 扩表不换人：30 条全都留着（sid 不变，已选配置不受影响），只往后加 18 条，
# 补的是各档原来空着的音高位置——
#   男低沉 118/121 → 补 131/139（男声 · 低沉 3/4）
#   男中年 146/150/160 → 补 161/163/164（中年男 4/5/6）
#   男偏高 182~194 全挤在高处 → 补 167/175 填低端（男声 · 偏高 1/2）
#   女低音 204/205/213 → 补 211（女声 · 低音 3）
#   女成年 217/220/232/238 → 补 239/239（成年女 5/6）
#   女青年 249~270 → 补 243/246/251/257/262/269（青年女 9~14）
#   女高音只有童声 → 补 278/280（女声 · 高音 1/2，成年女高音）
#
# 命名原则没变：只给实测基频说得清的名字（档位 + 序号），不给年龄预期；
# 编号接着同家族最大号往上加，sid 一个都没动。
#
# 2026-11-13 用户反馈「精选里男女青年占比要稍多一些」「低沉少一点」时扩到 30 条：
#   男 13 条：低沉 2、中年 3、中音 3、青年 5
#   女 15 条：女低 2、沉稳 1、成年 4、青年 8
#   童 2 条；青年合计 13/30 = 43%，低沉只占 6.7%。
#
# 2026-11-11 按实测基频重命名（依据 _voice_audit.md，测试句「那年冬天老李拎着一篮梨从南方慢慢走来」）：
# 原来的「青年男 1~4」名不副实——实测 s110 133 Hz 是全组第二低，s52 144、s102 151 都在中年男区间，
# 只有 s32（174 Hz）真够青年。用户按「青年男」预期去选，听到的是中年嗓子，这才是「男声不对劲」的来源之一。
# 现在改成不给年龄预期的中性名，编号也不再暗示高低。sid 不变，用户已选中的音色不受影响。
CURATED = [
    ('s124', '老生 · 低沉 1'),
    ('s74',  '老生 · 低沉 2'),
    ('s119', '男声 · 低沉 3'),
    ('s40',  '男声 · 低沉 4'),
    ('s58',  '中年男 1'),
    ('s163', '中年男 2'),
    ('s156', '中年男 3'),
    ('s98',  '中年男 4'),
    ('s143', '中年男 5'),
    ('s107', '中年男 6'),
    ('s167', '中年男 7'),
    ('s76',  '男声 · 偏高 1'),
    ('s52',  '男声 · 中音 1'),
    ('s110', '男声 · 中音 2'),
    ('s102', '男声 · 中音 3'),
    ('s65',  '男声 · 偏高 2'),
    ('s174', '青年男 1'),
    ('s32',  '青年男 2'),
    ('s148', '青年男 3'),
    ('s72',  '青年男 4'),
    ('s83',  '青年男 5'),
    ('s36',  '女声 · 低音 1'),
    ('s23',  '女声 · 低音 2'),
    ('s144', '女声 · 低音 3'),
    ('s169', '沉稳女 1'),
    ('s13',  '成年女 1'),
    ('s149', '成年女 2'),
    ('s19',  '成年女 3'),
    ('s165', '成年女 4'),
    ('s84',  '成年女 5'),
    ('s178', '成年女 6'),
    ('s6',   '青年女 9'),
    ('s77',  '青年女 10'),
    ('s129', '青年女 1'),
    ('s164', '青年女 11'),
    ('s120', '青年女 2'),
    ('s22',  '青年女 12'),
    ('s103', '青年女 13'),
    ('s20',  '青年女 3'),
    ('s28',  '青年女 4'),
    ('s185', '青年女 5'),
    ('s71',  '青年女 6'),
    ('s108', '青年女 7'),
    ('s68',  '青年女 14'),
    ('s85',  '青年女 15'),
    ('s64',  '青年女 8'),
    ('s125', '女声 · 高音 1'),
    ('s139', '女声 · 高音 2'),
    ('s41',  '童声 1'),
    ('s105', '童声 2'),
]
CURATED_LABEL = dict(CURATED)

# 音高分档：195 Hz 是男女分界，与上面 CURATED 的命名口径一致。
BANDS = [
    ('男声 · 低沉', 0,   140),
    ('男声 · 中年', 140, 165),
    ('男声 · 偏高', 165, 195),
    ('女声 · 低音', 195, 215),
    ('女声 · 成年', 215, 240),
    ('女声 · 青年', 240, 270),
    ('女声 · 高音', 270, 999),
]


# 人工校正：音高分档分不准的个别声线，档位单独指定。只加试听确认过的，别凭猜。
BAND_OVERRIDE = {
    41: '女声 · 高音',   # 童声 1：中位基频 251 Hz 会落进「女声 · 青年」，实际听感是童声
    # 下面三个：数据集的标注基频（168/169/174）与实测差得远（143/133/151 实测），
    # 按表值会落进「男声 · 偏高」组，和它们在精选里叫「中音」对不上。按实测归中年组。
    52: '男声 · 中年',
    110: '男声 · 中年',
    102: '男声 · 中年',
}


def band_of(hz, sid=None):
    if sid is not None and sid in BAND_OVERRIDE:
        return BAND_OVERRIDE[sid]
    for name, lo, hi in BANDS:
        if lo <= hz < hi:
            return name
    return '女声 · 高音'


def _shared_files():
    """小雅与超文共用的词表与数字规则（tokens, lexicon, 三个 fst）。"""
    return [os.path.join(MODEL_DIR, SHARED_DIR, n)
            for n in ('tokens.txt', 'lexicon.txt') + tuple(SHARED_FSTS)]


def _v(sid, label, hz):
    """fanchen 的一个说话人：三个库文件共用，靠 sid 切声线。

    resbase='s' 表示这套声线也进得了常驻引擎（sherpa_onnx 的 generate(sid=) 直接切人）。
    常驻可用时 _probe_resident 会给它置 fast=True，之后就不必每条起一个子进程——
    2026-11-13 实测：常驻下 fanchen 一句 19 字 0.92 秒，跟 22 kHz 主角一样快，
    以前「每句 12 秒」全是命令行子进程反复载模型的账。"""
    d = os.path.join(MODEL_DIR, FANCHEN_DIR)
    files = [os.path.join(d, 'model.onnx'), os.path.join(d, 'tokens.txt'),
             os.path.join(d, 'lexicon.txt')]
    return {'kind': 'vits', 'model': files[0], 'files': files, 'sid': sid,
            'dict_dir': os.path.join(d, 'dict'), 'resbase': 's', 'base': 's',
            'pitch': 1.0,
            'label': label, 'band': band_of(hz, sid), 'f0': hz}


def _single(d, f0, label):
    """单说话人主角：模型在各自目录，词表与规则取自 shared。"""
    model = os.path.join(MODEL_DIR, d, 'model.onnx')
    return {'kind': 'vits', 'model': model, 'files': [model] + _shared_files(),
            'sid': None, 'label': label, 'band': band_of(f0), 'f0': f0}


def _matcha_files():
    d = os.path.join(MODEL_DIR, MATCHA_DIR)
    return ([os.path.join(d, MATCHA_MODEL), os.path.join(d, MATCHA_VOCODER)]
            + _shared_files())


def matcha_ready():
    return all(os.path.isfile(p) for p in _matcha_files())


def _m():
    return {'kind': 'matcha', 'model': _matcha_files()[0],
            'vocoder': MATCHA_VOCODER, 'files': _matcha_files(), 'sid': None,
            'fsts': SHARED_FSTS, 'label': '墨吟 · 中文女声',
            'band': band_of(MATCHA_F0), 'f0': MATCHA_F0}


def single_ready(d):
    return (os.path.isfile(os.path.join(MODEL_DIR, d, 'model.onnx'))
            and all(os.path.isfile(p) for p in _shared_files()))


VOICES = {}
if single_ready(XIAOYA_DIR):
    VOICES['x0'] = _single(XIAOYA_DIR, XIAOYA_F0, '旧版 22k · 女声')
if single_ready(CHAOWEN_DIR):
    VOICES['c0'] = _single(CHAOWEN_DIR, CHAOWEN_F0, '旧版 22k · 男声')
if not VOICES and matcha_ready():
    VOICES['m0'] = _m()

# 187 个配角音色与主角共存：主角负责好听，它们负责不同年龄段的配角。
if os.path.isfile(os.path.join(MODEL_DIR, FANCHEN_DIR, 'model.onnx')):
    for _sid in sorted(SID_F0):
        _key = 's%d' % _sid
        VOICES[_key] = _v(_sid, CURATED_LABEL.get(_key) or ('音色 %d' % _sid), SID_F0[_sid])

# ---------------- 常驻引擎 ----------------
#
# 2026-11-09 实测（本机 12 核）：命令行版 sherpa-onnx-offline-tts.exe **每合成一个
# 片段都要重启一次进程**，光是启动 + 载模型就 1.9 秒。一段 15 个片段的长对白，
# 并行 6 路也要 9.9 秒——这就是「到对话这里要等十秒」的真凶，跟模型快慢无关。
#
# 同一份模型用 sherpa_onnx 的 Python 绑定常驻内存后：
#   加载一次 1.6 秒，之后每片段 0.3~0.7 秒，整段 15 片段并行 2.7 秒。
# 所以桌面端一律走常驻；只有在没装 sherpa_onnx（Linux 包、源码直跑没装依赖）时
# 才回退到命令行子进程，行为跟以前完全一样。
#
# 配角声线：fanchen 那套 16 kHz 多说话人模型听着最好，但推理慢 20 倍
# （实测一句 20 字要 12~16 秒），只要角色一开口就必然干等。这里换成正主
# 两个 22 kHz 声线的**变调族**：同一次合成结果做一次线性插值重采样，
# 音高变、母语感不变，代价只有几毫秒。低音顺带念得慢一点、高音快一点，
# 正好跟「年长者语速慢、年轻人语速快」对得上。
_PITCH = [('', 1.0), ('b', 0.94), ('c', 0.89), ('d', 1.06)]
_BASE_DIR = {'f': XIAOYA_DIR, 'm': CHAOWEN_DIR}
_BASE_F0 = {'f': XIAOYA_F0, 'm': CHAOWEN_F0}
# 每个基干声线给出 4 个变体的显示名与音高档（band 必须以「男声/女声」开头，
# 页面那边靠这个前缀判男女，别改）。
# 第 0 个是基干原声，键名沿用老配置里的 x0 / c0：升级后「旧版 22k · 女声」还是同一个声音。
# 1.14.39 起精选是 50 条真人声线（fanchen 也进了常驻），这 6 个变调不再进精选，
# 只在「全部声线」里留着——同一个人的四种音高，挑不到合适的真人时仍是好用的备选。
_FAST_META = {
    'f': [('旧版 22k · 女声', '女声 · 清亮', 266),
          ('女声 2 · 沉稳', '女声 · 低音', 250),
          ('女声 3 · 低沉', '女声 · 低音', 237),
          ('女声 4 · 明亮', '女声 · 青年', 282)],
    'm': [('旧版 22k · 男声', '男声 · 中音', 163),
          ('男声 2 · 沉稳', '男声 · 中年', 153),
          ('男声 3 · 低沉', '男声 · 低沉', 145),
          ('男声 4 · 清亮', '男声 · 偏高', 173)],
}
_FAST_KEY = {'f': ['x0', 'f1', 'f2', 'f3'], 'm': ['c0', 'm1', 'm2', 'm3']}

RES = {'tried': False, 'mod': None, 'pool': {}, 'lock': threading.Lock(), 'err': ''}
FAST = False          # 常驻引擎可用时置 True，_synth_one 据此分派


def _fast_spec():
    """把 x0/f1..f3、c0/m1..m3 塞进 VOICES。base=基干模型，pitch=音高倍率。

    0 号就是基干原声，键名沿用老配置里的 x0 / c0，用户选中的「旧版 22k · 女声」
    升级后还是同一个声音。f0 / m0 这两个旧键名不再单独建——老配置指到它们时
    由页面的 fixLocalVoice 落到默认 x0 / c0，听到的是同一个声音。
    """
    out = {}
    for base, metas in _FAST_META.items():
        for i, (label, band, hz) in enumerate(metas):
            key = _FAST_KEY[base][i]
            out[key] = {'kind': 'fast', 'fast': True, 'base': base,
                        'pitch': _PITCH[i][1], 'sid': None,
                        'model': os.path.join(MODEL_DIR, _BASE_DIR[base], 'model.onnx'),
                        'files': [os.path.join(MODEL_DIR, _BASE_DIR[base], 'model.onnx')],
                        'label': label, 'band': band, 'f0': hz}
    return out


def _probe_resident():
    """import 一次看常驻引擎在不在。失败就彻底走老路，不反复试。"""
    global FAST
    if RES['tried']:
        return FAST
    RES['tried'] = True
    try:
        import sherpa_onnx as so
        RES['mod'] = so
        RES['ok'] = True
    except Exception as e:
        RES['ok'] = False
        RES['err'] = '%s: %s' % (type(e).__name__, e)
        return False
    # 1.14.40 起成品不再带两份 22 kHz 主角，常驻引擎的判据改成「配角库在不在」。
    # 但老 VoicePack（Lite 版外挂目录、或用户自己留下的那份）里还有 x0/c0，
    # 三个模型任意一个在都算可用，别让老包突然退化成子进程方式。
    has_lib = os.path.isfile(os.path.join(MODEL_DIR, FANCHEN_DIR, 'model.onnx'))
    has_lead = (os.path.isfile(os.path.join(MODEL_DIR, XIAOYA_DIR, 'model.onnx'))
                or os.path.isfile(os.path.join(MODEL_DIR, CHAOWEN_DIR, 'model.onnx')))
    if not (has_lib or has_lead):
        RES['ok'] = False
        RES['err'] = 'model missing'
        return False
    if has_lead:
        VOICES.update(_fast_spec())
    # 187 个配角也走常驻：多说话人模型的 generate(sid=) 直接换人，不用每条起一个子进程。
    # 2026-11-13 实测一句 19 字 0.92 秒（子进程方式 12 秒上下），从此精选才敢放到 50 条。
    # 每条声线只是模型里的一个说话人向量，多开一条不多占一个字节。
    if has_lib:
        for _k, _s in VOICES.items():
            if _s.get('resbase') == 's':
                _s['fast'] = True
    FAST = True
    return True


def _res_cfg(base):
    """常驻配置：与命令行版逐项对齐（silence 0.35 让引擎念紧凑，停顿我们自己插）。"""
    so = RES['mod']
    if base == 's':
        # 配角库跟主角不同源：它自带 tokens / lexicon 和 jieba 分词表，
        # 也没有 shared 那三个数字规则 fst（命令行路径里同样是 len(files) > 3 才加）。
        d = os.path.join(MODEL_DIR, FANCHEN_DIR)
        v = so.OfflineTtsVitsModelConfig(
            model=os.path.join(d, 'model.onnx'),
            tokens=os.path.join(d, 'tokens.txt'),
            lexicon=os.path.join(d, 'lexicon.txt'),
            dict_dir=os.path.join(d, 'dict'))
        m = so.OfflineTtsModelConfig(vits=v, num_threads=2, debug=False, provider='cpu')
        c = so.OfflineTtsConfig(model=m)
        c.silence_scale = SILENCE_SCALE
        c.max_num_sentences = 1
        return c
    d = _BASE_DIR[base]
    v = so.OfflineTtsVitsModelConfig(
        model=os.path.join(MODEL_DIR, d, 'model.onnx'),
        tokens=os.path.join(MODEL_DIR, SHARED_DIR, 'tokens.txt'),
        lexicon=os.path.join(MODEL_DIR, SHARED_DIR, 'lexicon.txt'))
    m = so.OfflineTtsModelConfig(vits=v, num_threads=2, debug=False, provider='cpu')
    c = so.OfflineTtsConfig(model=m)
    # 与命令行版一致：三个数字/电话规则 fst
    c.rule_fsts = ','.join(os.path.join(MODEL_DIR, SHARED_DIR, x) for x in SHARED_FSTS)
    c.silence_scale = SILENCE_SCALE
    # 一次只喂一句话：我们已经在标点处切好了，让引擎再分句会把停顿拆散
    c.max_num_sentences = 1
    return c


def _res_pool(base, n=None):
    """每个基干声线建 n 个实例轮转（22 kHz 单实例约 105 MB，配角库约 175 MB）。

    实例数按 CPU 核数给：本机 12 核实测 10 个片段 2 实例 2.7 秒 / 3 实例 2.1 秒 /
    4 实例 1.8 秒，收益递减而内存线性上涨。女主声线用得最多（旁白＋多数对白）给 3 个，
    男声给 2 个；4 核及以下的小机器各减一个，别为了快把内存吃光。

    配角库 's' 只给 1 个：实测 187 人那套每句 1.2~1.6 秒（和 22 kHz 主角同速），
    对白本来就是一句接一句，多开一个实例内存 +175 MB，实测稳态几乎看不出差别
    （三个池全建好是 737 MB，只留一个就回到 560 MB）。这一份只在第一次用到
    配角声线时才建，光听旁白的人内存停在 390 MB。
    """
    if n is None:
        cores = os.cpu_count() or 4
        if base == 's':
            n = 1
        else:
            n = (3 if base == 'f' else 2) if cores >= 8 else (2 if base == 'f' else 1)
    p = RES['pool'].get(base)
    if p:
        return p
    with RES['lock']:
        p = RES['pool'].get(base)
        if p:
            return p
        insts = [RES['mod'].OfflineTts(_res_cfg(base)) for _ in range(n)]
        import queue as _q
        q = _q.Queue()
        for x in insts:
            q.put(x)
        p = RES['pool'][base] = {'q': q, 'n': n}
    return p


# ---------------- 英文：可选模型 + 中英混排 ----------------
#
# 中文三个模型的 lexicon 里一个英文字母都没有（2026-11-09 实测：68 012 条词条，
# hello / world / OK / CPU 全都没有）。所以：
#   · 纯英文段落 -> 每个片段都合成不出声 -> 整句 500 -> 页面当引擎坏了
#   · 中英混排   -> 英文单词被静默丢掉（「他打开 iPhone 看了一眼」听成「他打开 看了一眼」）
# 装 models/piper-en（piper 英文 int8，约 22 MB，自带 espeak-ng-data）之后：
#   · 纯英文整段交给英文模型；
#   · 混排按语言切片，中文段仍用角色的声线，英文段用英文模型，接回去不留缝。
# 没装英文模型也不算故障：纯英文块抛 NoEnVoice，页面改用系统英文语音，
# 而不是弹「引擎不可用」。
_HAN_RE = re.compile(r'[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]')
_LAT_RE = re.compile(r'[A-Za-z]')


class NoEnVoice(RuntimeError):
    """这一段是外文，但这台机器没装英文模型。页面据此换系统英文语音。"""


def has_han(s):
    return bool(_HAN_RE.search(s or ''))


def has_latin(s):
    return bool(_LAT_RE.search(s or ''))


def lang_split(s):
    """把片段按语言切开：[('iPhone', 'en'), (' 15 ', 'zh'), ('Pro', 'en')]。

    英文只认拉丁字母（以及词内撇号/连字符）。数字、汉字、标点都留给中文模型——
    它有 date/number fst，「2026 年 3 月」读得比英文模型自然。
    """
    out, buf, cur = [], [], None
    for ch in s:
        if ch.isspace():
            # 空格跟着当前这一片走：「Hello world」不该被切成两个英文片段
            if cur is not None:
                buf.append(ch)
            continue
        t = 'en' if (ch.isascii() and (ch.isalpha() or ch in "'\u2019-")) else 'zh'
        if cur is None or t == cur:
            buf.append(ch)
            cur = t
        else:
            out.append((''.join(buf), cur))
            buf = [ch]
            cur = t
    if buf:
        out.append((''.join(buf), cur))
    # 纯标点片（「……」「——」）没有字可念，丢掉；数字片要留（中文模型有数字 fst）
    return [(x, t) for x, t in out
            if _HAN_RE.search(x) or re.search(r'[0-9A-Za-z]', x)]


EN = {'pool': None, 'lock': threading.Lock()}


def _en_dir():
    return os.path.join(MODEL_DIR, EN_DIR)


def en_ready():
    """英文模型在不在。只在常驻模式下有用（命令行兜底路径不支持英文）。"""
    if not FAST:
        return False
    d = _en_dir()
    return all(os.path.isfile(os.path.join(d, f))
               for f in ('model.onnx', 'tokens.txt', 'lexicon.txt'))


def _en_cfg():
    so = RES['mod']
    d = _en_dir()
    # 有 lexicon 就不需要 espeak 前端：词表里没有的词 sherpa 会跳过（Ignore OOV），
    # 念不出来的整句会返回空音频，由 _synth_en 抛 NoEnVoice 交给页面兜底。
    v = so.OfflineTtsVitsModelConfig(
        model=os.path.join(d, 'model.onnx'),
        tokens=os.path.join(d, 'tokens.txt'),
        lexicon=os.path.join(d, 'lexicon.txt'))
    m = so.OfflineTtsModelConfig(vits=v, num_threads=2, debug=False, provider='cpu')
    c = so.OfflineTtsConfig(model=m)
    c.silence_scale = SILENCE_SCALE
    c.max_num_sentences = 1
    return c


def _en_pool():
    """英文实例只建一个：书里英文本来就少，不值得为它多占一份内存。"""
    if EN['pool'] is not None:
        return EN['pool']
    with EN['lock']:
        if EN['pool'] is None:
            import queue as _q
            q = _q.Queue()
            q.put(RES['mod'].OfflineTts(_en_cfg()))
            EN['pool'] = {'q': q}
    return EN['pool']


def _en_gen(text, speed):
    """一次英文模型调用。念不出声（整句 OOV）返回 None，不抛异常。"""
    p = _en_pool()
    inst = p['q'].get()
    try:
        au = inst.generate((text or '').lower(), sid=EN_SID, speed=speed or 1.0)
    finally:
        p['q'].put(inst)
    if not len(au.samples):
        return None
    return _pcm16(au.samples, au.sample_rate)


EN_LEX = {'set': None}


def _en_lex():
    """词表里有哪些词（小写）。12.3 万条，只读一次。

    用来在合成之前就认出 OOV 词——CPU / macOS / WiFi 这类缩写和产品名
    一个都不在 LJSpeech 词表里。以前它们会让整段英文返回空音频，
    再往上把整句中文一起拖成 415，听书时表现为「这一句被跳过」。
    """
    if EN_LEX['set'] is not None:
        return EN_LEX['set']
    s = set()
    try:
        with io.open(os.path.join(_en_dir(), 'lexicon.txt'), encoding='utf-8') as f:
            for line in f:
                w = line.split(' ', 1)[0]
                if w:
                    s.add(w)
    except Exception:
        pass
    EN_LEX['set'] = s
    return s


# 一个英文词：字母开头，允许词内撇号 / 连字符（don't、state-of-the-art）
_EN_WORD = re.compile(r"[A-Za-z][A-Za-z'\u2019\-]*")


def _synth_en(text, speed):
    """英文片段：走 icefall 英文模型，不和中文声线抢实例池。

    词典全是小写词条（12.3 万条，零个大写开头），所以先 lower()。
    整段都认识 -> 一次调用，快。有生词（CPU / macOS / WiFi / 人名）时改成
    逐词合成：认识的照常念，生词按字母念（a-p-p-l-e），再一个词都念不出来
    才抛 NoEnVoice。这样「一台 iPhone 15 Pro」不会因为 Pro 是生词就整段哑掉。
    """
    t = (text or '').strip()
    if not t:
        raise NoEnVoice(text)
    low = t.lower()
    words = _EN_WORD.findall(low)
    known = _en_lex()
    if not words or all(w in known for w in words):
        d = _en_gen(low, speed)
        if d:
            return d
    pieces = []
    for w in _EN_WORD.findall(t):
        lw = w.lower()
        d = _en_gen(lw, speed) if (not known or lw in known) else None
        if not d and len(lw) > 1:
            # 生词按字母念：「CPU」->「C P U」；字母 26 个在词表里都有
            d = _en_gen(' '.join(lw), speed)
        if not d:
            d = _en_gen(lw, speed)          # 再原样试一次（词形变化、大小写混写）
        if d:
            pieces.append(d)
    if not pieces:
        raise NoEnVoice(text)
    if len(pieces) == 1:
        return pieces[0]
    return _join([(x, 0.0) for x in pieces])


def _pcm16(samples, sr):
    """float32 [-1,1] -> 16bit 单声道 WAV 字节。跟命令行版输出格式保持一致。"""
    import numpy as np
    a = np.clip(np.asarray(samples, dtype=np.float32), -1.0, 1.0) * 32767.0
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(a.astype('<i2').tobytes())
    return buf.getvalue()


def _pitch_shift(samples, r):
    """线性插值重采样：r<1 音高变低、r>1 变高（时长同时变 1/r）。
    朗读里这点语速差反而是好事——低音的年长者本来就该念得慢些。"""
    import numpy as np
    s = np.asarray(samples, dtype=np.float32)
    n = len(s)
    if n < 16 or abs(r - 1.0) < 1e-3:
        return s
    m = max(8, int(round(n / r)))
    src = np.arange(n, dtype=np.float32)
    idx = np.linspace(0.0, n - 1.0, m, dtype=np.float32)
    return np.interp(idx, src, s).astype(np.float32)


def _synth_res(text, base, speed, pitch, sid=None):
    """常驻合成一句。实例从池里借，借不到就排队等——不会并发踩同一个实例。

    sid：配角库靠它选说话人（0~186）；主角是单说话人模型，传 None 即可。
    主角的 4 个音高变体靠 pitch 做重采样，配角库不重采样（pitch=1.0）。
    """
    p = _res_pool(base)
    inst = p['q'].get()
    try:
        au = inst.generate(text, sid=(0 if sid is None else int(sid)), speed=speed)
    finally:
        p['q'].put(inst)
    s = au.samples
    if abs(pitch - 1.0) > 1e-3:
        s = _pitch_shift(s, pitch)
    return _pcm16(s, au.sample_rate)


def warm_resident(which='fm'):
    """后台把所有常驻实例建起来。点「朗读」之前先叫醒，第一句就不用等 1.6 秒。"""
    if not FAST:
        return False
    for base in ('f', 'm', 's'):
        if base not in which:
            continue
        try:
            _res_pool(base)
        except Exception:
            pass
    return True


# 启动时就探一次：常驻引擎能不能用决定后续走哪条路，也决定 /health 报什么。
_probe_resident()

# 默认音色：1.14.40 起成品不再带 22 kHz 主角，默认落到精选里最适合作旁白的两条
# 真人声线——女 s13（成年女 1）。名字得在 CURATED 里靠前，不然第一次打开听到的
# 是「老生 · 低沉 1」，那是男低音，拿来念旁白没法听（安卓那边也是这么处理的：
# health 里专门报一个 default 字段，页面 fixLocalVoice 认它，不靠猜列表第一个）。
# 老 VoicePack 还带着 x0/c0 时，仍按老习惯先给「旧版 22k · 女声」。
def _first_present(*keys):
    for k in keys:
        if k in VOICES:
            return k
    return next(iter(VOICES)) if VOICES else 's12'


DEFAULT_VOICE = _first_present('s13', 'x0', 's36', 's149', 'c0', 'm0')


_sem = threading.Semaphore(12 if FAST else 6)   # 子进程并行数；常驻模式不受它限制
PARALLEL = 8 if FAST else 6                     # 一段里同时合成的片段数
_cache = OrderedDict()                 # 整段缓存：重听同一段直接命中
_seg_cache = OrderedDict()             # 片段缓存：同一短句在书里反复出现时省掉重复合成
_cache_lock = threading.Lock()
CACHE_MAX = 48
SEG_CACHE_MAX = 400
MAX_TEXT = 600                         # 单次最多 600 字，防止超长文本卡死

# ---------------- 停顿：按「人念书」的实际时长分层 ----------------
#
# 为什么不用引擎的 --tts-silence-scale 一把梭：
#   实测（2026-11-08）那个倍率会**同时**放大所有停顿，连无标点的词间空隙也一起放大
#   （无标点文本在 scale=1.6 时最长空隙 0.96 秒）。也就是说它只改变「整体留白量」，
#   不改变「逗号 : 句号」的比例，所以调到多大逗号都还是被词间空隙淹没。
#   用户听到的就是「逗号几乎没间隔」。
#
# 所以改成：让引擎把每一小节念紧凑（scale 压到 0.35），小节之间该停多久，
# 由下面这张表按标点类型自己插——这才是人朗读时的停顿层级。
# 数值取自有声书演播的通行标准（逗号约半个字到一个字长，句号约两个半到三个字长，
# 段落更长且要留出换气口），不是新闻播报那种更短的节奏。
PAUSE = {
    '、': 0.28,                       # 顿号：并列词之间，短促，不能用成逗号
    '，': 0.38, ',': 0.34,
    '；': 0.48, ';': 0.44,
    '：': 0.46, ':': 0.42,
    '。': 0.75, '.': 0.72,
    '！': 0.80, '!': 0.76,
    '？': 0.78, '?': 0.74,
    '…': 0.92,                        # 省略号：留白，要明显长于句号
    '—': 0.58,                        # 破折号：转折，一顿
    '～': 0.26, '~': 0.26,
}
PARA_PAUSE = 1.10                     # 段落之间：换气 + 让听众回过神
GAP_FLOOR = 0.02                      # 片段之间至少留 20ms，免得首尾相接糊成一个字
GAP_NOISE = 26                        # 停顿里铺的极轻底噪（约 -62 dBFS）
SENT_END_MIN = 0.70                   # 停顿达到这个长度就算「句末」，念得从容一点

# 片段内部的停顿倍率：压小，让引擎把每一小节念紧凑。
SILENCE_SCALE = 0.35


def find_exe():
    if not os.path.isdir(ENGINE_DIR):
        return None
    for root, _dirs, files in os.walk(ENGINE_DIR):
        if 'sherpa-onnx-offline-tts.exe' in files:
            return os.path.join(root, 'sherpa-onnx-offline-tts.exe')
    return None


def voice_files(voice):
    """返回 (模型文件, 该音色必需的全部文件路径)。files 里存的已是绝对路径，
    因为小雅、超文的词表在 shared，与模型不在同一个目录。"""
    s = VOICES[voice]
    return s['model'], list(s['files'])


_ready_cache = {}


def voice_ready(voice):
    """187 个配角共用同一份模型，按模型路径缓存一次，避免每次探测做上千次 stat。"""
    s = VOICES[voice]
    key = s['model']
    ok = _ready_cache.get(key)
    if ok is None:
        ok = all(os.path.isfile(p) for p in s['files'])
        _ready_cache[key] = ok
    return ok


def health():
    exe = find_exe()
    voices = {v: voice_ready(v) for v in VOICES}
    # 推荐列表 = 主角两条 + 精选（桌面端 50 条）。1.14.39 起配角库也走常驻，
    # 每句 0.9 秒，跟主角没差别，所以不再分「常驻推荐 8 条 / 子进程推荐 30 条」两套。
    order = []
    for v in ['x0', 'c0'] + [k for k, _l in CURATED]:
        if v in VOICES:
            order.append(v)
    return {
        'ok': (bool(exe) or FAST) and any(voices.values()),
        'engine': 'sherpa-onnx 2.0.1' if (exe or FAST) else 'missing',
        'resident': FAST,
        'voices': voices,
        'labels': {v: VOICES[v]['label'] for v in VOICES},
        'groups': {v: VOICES[v]['band'] for v in VOICES},
        'f0': {v: VOICES[v]['f0'] for v in VOICES},
        'curated': order or list(VOICES),
        # 默认声线交给引擎说，别让页面猜列表第一个：1.14.40 起没有 x0/c0，
        # 精选第一条是「老生 · 低沉 1」（男低音），拿它念旁白没法听。
        'default': DEFAULT_VOICE,
        'count': len([v for v in VOICES if voices.get(v)]),
        'en': en_ready(),
        # 配角库模型在不在。页面用它决定要不要提示「正在准备语音库」，在就一次都别弹。
        'lib': voice_ready(CURATED[0][0]) if CURATED else False,
        # 男声降噪能不能用（numpy 在就可用）。页面据此决定三档开关是否可点。
        'dn': bool(_dn is not None),
        'version': 8,
        'engineKind': VOICES[DEFAULT_VOICE]['kind'] if DEFAULT_VOICE in VOICES else 'vits',
    }


def build_args(voice, out, length_scale=1.0, silence_scale=None):
    """按音色拼出引擎命令行参数（VITS 或 Matcha + 可选 sid / 中文规则）。"""
    s = VOICES[voice]
    _d, f = voice_files(voice)
    if s['kind'] == 'matcha':
        a = ['--matcha-acoustic-model=' + f[0], '--matcha-vocoder=' + f[1],
             '--matcha-tokens=' + f[2], '--matcha-lexicon=' + f[3]]
        if f[4:]:
            a.append('--tts-rule-fsts=' + ','.join(f[4:]))
        a.append('--tts-silence-scale=%s'
                 % (SILENCE_SCALE if silence_scale is None else silence_scale))
        if abs(length_scale - 1.0) > 1e-6:
            a.append('--matcha-length-scale=%.4f' % length_scale)
        return a + ['--num-threads=4', '--output-filename=' + out]

    a = ['--vits-model=' + f[0], '--vits-tokens=' + f[1], '--vits-lexicon=' + f[2]]
    if s.get('sid') is not None:
        a.append('--sid=' + str(s['sid']))
    # fanchen 有自己的词典，没有配数字规则 fst，所以按实际长度判断而不是看键。
    if len(f) > 3:
        a.append('--tts-rule-fsts=' + ','.join(f[3:]))
    # 配角库带 jieba 分词表，多音字（长/重/行/了）读法比纯词典准。
    if s.get('dict_dir'):
        a.append('--vits-dict-dir=' + s['dict_dir'])
    a.append('--tts-silence-scale=%s'
             % (SILENCE_SCALE if silence_scale is None else silence_scale))
    # 语速交给引擎（改音素时长、不动音高），而不是让浏览器变速——
    # 浏览器 playbackRate 变的是整体速率，念书的「长句从容、短句利落」出不来。
    if abs(length_scale - 1.0) > 1e-6:
        a.append('--vits-length-scale=%.4f' % length_scale)
    return a + ['--num-threads=2', '--output-filename=' + out]


def clean_text(s):
    """去掉控制字符、合并空白。保留换行——换行是段落边界，停顿要比句号更长。"""
    s = str(s or '').replace('\r\n', '\n').replace('\r', '\n').replace('\t', ' ')
    s = ''.join(ch for ch in s if ch == '\n' or (ord(ch) >= 32 and ord(ch) != 127))
    out = []
    for ch in s:
        if ch == ' ' and (not out or out[-1] in ' \n'):
            continue
        if ch == '\n' and (not out or out[-1] == '\n'):
            continue
        out.append(ch)
    return ''.join(out).strip()[:MAX_TEXT]


def prosody_split(text):
    """把文本切成 [(片段, 其后停顿秒数, 该停顿对应的标点)]，停顿按标点类型分层。

    只在句末标点处断段（句号、问号、叹号、分号、省略号），逗号/顿号/冒号留在
    段内——引擎自己会按标点停顿，而且长段合成的音质明显比切成 3~6 字的小块好。
    段内超过 MAX_SEG 字才在最近的一个句内标点处兜底断开，避免一句过长时
    引擎把后半句念飘。
    """
    out = []
    buf = []

    def flush(gap, punct):
        seg = ''.join(buf).strip()
        if seg:
            out.append((seg, gap, punct))
        del buf[:]

    i, n = 0, len(text)
    while i < n:
        ch = text[i]
        if ch == '\n':
            flush(PARA_PAUSE, '。')
            i += 1
            continue
        # 小数点与时间里的冒号不是标点（3.5、12:30），别在这里断
        if ch in '.:' and 0 < i < n - 1 and text[i - 1].isdigit() and text[i + 1].isdigit():
            buf.append(ch)
            i += 1
            continue
        if ch in HARD_STOP:
            # 连续标点（？！ …… ——）取最长的那个，不要再叠
            j, gap = i, 0.0
            while j < n and text[j] in PAUSE:
                gap = max(gap, PAUSE[text[j]])
                j += 1
            flush(gap, text[j - 1])
            i = j
            continue
        buf.append(ch)
        i += 1
        if ch in SOFT_STOP and _cjk_len(''.join(buf)) >= MAX_SEG:
            flush(PAUSE.get(ch, 0.38), ch)
    flush(0.0, '')
    return out


MIN_SEG = 2                            # 少于这个字数的片段并进相邻片段
INNER_PUNCT = '，,、；;：:。！？!?…—～~'

# 只在这些标点处真正断段；逗号、顿号、冒号留在段内交给引擎自己停。
# 为什么不再按逗号切：一段话被切成一串 3~6 字的小块，每块单独合成再拼接，
# 一来语调断成一片，二来短输入正是量化模型失真最重的区间（实测 4 字段
# 的谱平坦度比 14 字段高一倍），听感就是「几个字糊成一团」。
# 现在一段 = 一整句，15~30 字，既连贯又落在失真小的区间。
HARD_STOP = '。！？!?；;….'
SOFT_STOP = '，,、：:—～~'
MAX_SEG = 34                           # 长句保护：超过这个字数才在逗号处兜底断开


def _cjk_len(s):
    return sum(1 for c in s if '\u4e00' <= c <= '\u9fff' or c.isdigit())


def _inner_scale(text):
    """片段里还带着标点，说明是由短片段合并来的，得让引擎把内部停顿放出来；
    内部没有标点的片段照常念紧凑，停顿全部由我们自己按表插。"""
    return 1.0 if any(c in INNER_PUNCT for c in text) else SILENCE_SCALE


def merge_short(segs):
    """把过短的片段并进相邻片段，合并时保留原标点。

    实测（2026-11-08）：孤立的一两个字送给引擎经常合成成静音——「纸」峰值 3、
    「墨水」峰值 7，而「笔」是 1146。同一批字放进上下文就正常
    （「白纸」「他蘸了墨水」都没问题）。这类片段单独占一次引擎调用，
    听感上却白白多出一段空白，必须先并掉。
    """
    out = []
    for seg, gap, pun in segs:
        if out and len(seg) < MIN_SEG:
            p, _pg, pp = out[-1]
            out[-1] = (p + pp + seg, gap, pun)
        else:
            out.append((seg, gap, pun))
    # 开头就太短、前面没得并时，并进后一段
    while len(out) > 1 and len(out[0][0]) < MIN_SEG:
        a, _ag, ap = out[0]
        b, bg, bp = out[1]
        out[0:2] = [(a + ap + b, bg, bp)]
    return out


def _peak(wav_bytes):
    """片段峰值。用来判断这一次合成是不是等于没出声。"""
    try:
        _sr, a = _read_wav(wav_bytes)
    except Exception:
        return 0
    if not a:
        return 0
    return max(max(a), -min(a))


def _synth_units(units, voice):
    """并行合成，并保证每一段都真的出了声。

    无声的片段并进相邻片段重来——这是实测出来的必要一步，
    引擎对某些孤立词（「墨水」）会返回近乎全零的波形，不检查就会在书里留下一段空白。
    """
    jobs = []
    if not en_ready():
        # 没装英文模型时，纯英文片段念不出来（不是故障）。跳过它，把它该有的停顿
        # 让给前一片——否则「他打开 iPhone 看了一眼」会在 iPhone 那里留一处空白。
        for u in units:
            if has_latin(u[0]) and not has_han(u[0]):
                if jobs:
                    prev = jobs[-1]
                    jobs[-1] = (prev[0], max(prev[1], u[1])) + tuple(prev[2:])
                continue
            jobs.append(u)
        if not jobs:
            raise NoEnVoice('no english voice installed')
    else:
        jobs = list(units)
    workers = max(1, min(PARALLEL, len(jobs)))

    def run(js):
        with ThreadPoolExecutor(max_workers=workers) as ex:
            return list(ex.map(
                lambda x: _synth_one(x[0], voice, length_scale_of(x[0], x[1]), _inner_scale(x[0])),
                js))

    for _ in range(3):
        if not jobs:
            return []
        parts = run(jobs)
        bad = {i for i, d in enumerate(parts) if _peak(d) < 300}
        if not bad:
            return [(d, j[1]) for d, j in zip(parts, jobs)]
        jobs = _merge_bad(jobs, bad)

    parts = run(jobs) if jobs else []
    return [(d, j[1]) for d, j in zip(parts, jobs) if _peak(d) >= 300]


def _merge_bad(jobs, bad):
    """把没出声的片段并进前面那一段（开头没有前面的就并进后一段）。"""
    out = []
    n = len(jobs)
    i = 0
    while i < n:
        t, g, p = jobs[i]
        while i + 1 < n and (i + 1) in bad:
            t = t + p + jobs[i + 1][0]
            g, p = jobs[i + 1][1], jobs[i + 1][2]
            i += 1
        if i in bad and out:
            mt, mg, mp = out[-1]
            out[-1] = (mt + mp + t, g, p)
        else:
            out.append((t, g, p))
        i += 1
    return out


def length_scale_of(seg, gap):
    """按句子长短和所处位置微调语速，消掉「每句一个调、一样快」的机械感。

    幅度刻意做小（±3%）：人能察觉的是「有变化」，不是「变快了多少」。
    """
    n = len(seg)
    ls = 1.0
    if n <= 5:
        ls = 0.97          # 短句利落，不拖着念
    elif n >= 26:
        ls = 1.03          # 长句从容，一口气念不完的字别挤
    if gap >= SENT_END_MIN:
        ls += 0.04         # 句末收住，念完一句才落得下来
    return round(ls, 3)


def _read_wav(data):
    """返回 (采样率, array('h'))。引擎固定输出 16bit 单声道，双声道也能吃。"""
    with wave.open(io.BytesIO(data)) as w:
        sr, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(w.getnframes())
    if sw != 2:
        raise RuntimeError('不支持的位深：%s' % sw)
    a = array.array('h')
    a.frombytes(raw)
    if ch > 1:
        a = array.array('h', (a[k] for k in range(0, len(a), ch)))
    return sr, a


def _trim(a, sr, keep_lead=0.015, keep_trail=0.030, thr=0.009):
    """裁掉引擎在片段首尾自带的静音。

    实测（2026-11-08）：每段开头有 0.12~0.18 秒、结尾有 0.14~0.36 秒的空白。
    不裁掉的话，① 每个片段之间白多出三分之一秒，整段拖沓；
    ② 停顿实际长度完全不受控——逗号处会从 0.38 秒涨到 0.68 秒，跟句号糊成一级，
    听感上就还是「逗号没间隔」（这正是第一版没做对的原因）。
    """
    n = len(a)
    win = max(1, int(sr * 0.01))
    if n <= win * 2:
        return a
    first = None
    for i in range(0, n - win + 1, win):
        blk = a[i:i + win]
        if (sum(v * v for v in blk) / win) ** 0.5 / 32768.0 >= thr:
            first = i
            break
    if first is None:
        return a
    last = n
    for i in range((n - win) // win * win, -1, -win):
        blk = a[i:i + win]
        if (sum(v * v for v in blk) / win) ** 0.5 / 32768.0 >= thr:
            last = i + win
            break
    s = max(0, first - int(sr * keep_lead))
    e = min(n, last + int(sr * keep_trail))
    return a[s:e] if e - s > win else a


def _fallback_arg(gap, is_last):
    """片段之间铺的停顿：表值减去首尾各留的那点余量，保证听感时长就是表里的数。"""
    if is_last:
        return 0.0
    return max(GAP_FLOOR, gap - 0.045)


def _fade(a, sr, fin=0.006, fout=0.013):
    """首尾渐入渐出。硬拼两段波形会有「咔」的一声，实测最明显的地方就是这里。"""
    ni = min(int(sr * fin), max(1, len(a) // 3))
    no = min(int(sr * fout), max(1, len(a) // 3))
    for i in range(ni):
        a[i] = int(a[i] * (i / float(ni)))
    for i in range(no):
        k = len(a) - 1 - i
        a[k] = int(a[k] * (i / float(no)))
    return a


def _gap(sr, sec):
    """停顿音频。铺一层 -62 dBFS 的极轻底噪：绝对零会像录音断线，
    有这一点点底噪才像同一个房间里的自然留白，也顺带糊住拼接点。"""
    n = int(sr * sec)
    if n <= 0:
        return array.array('h')
    return array.array('h', (int(random.uniform(-GAP_NOISE, GAP_NOISE)) for _ in range(n)))


def _join(items):
    """[(wav 字节, 其后停顿秒数)] -> 一个 WAV 字节串。最后一段之后的停顿不铺。"""
    frames = array.array('h')
    sr = None
    last = len(items) - 1
    for idx, (data, gap) in enumerate(items):
        s, a = _read_wav(data)
        if sr is None:
            sr = s
        elif s != sr:
            raise RuntimeError('采样率不一致：%s vs %s' % (sr, s))
        frames.extend(_fade(_trim(a, sr), sr))
        g = _fallback_arg(gap, idx == last)
        if g > 0:
            frames.extend(_gap(sr, g))
    if sr is None:
        raise RuntimeError('nothing to join')
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(frames.tobytes())
    return buf.getvalue()


def _synth_zh(text, voice, length_scale, silence_scale):
    """中文片段：常驻引擎优先，没有才退子进程。"""
    s = VOICES.get(voice) or VOICES[DEFAULT_VOICE]
    if s.get('fast'):
        return _synth_res(text, s.get('base') or 's', 1.0 / (length_scale or 1.0),
                          s.get('pitch', 1.0), s.get('sid'))
    return _synth_cli(text, voice, length_scale, silence_scale)


def _synth_mixed(text, voice, length_scale):
    """中英混排：中文段用角色声线，英文段用英文模型，按原顺序接回去。

    接缝处只留 20 ms（_join 的下限），听感上是连着念的，不会在
    「他打开 iPhone」中间多出一次换气。
    """
    speed = 1.0 / (length_scale or 1.0)
    pieces = []
    for seg, lang in lang_split(text):
        if lang == 'en':
            # 这一小段英文念不出来，只丢这一小段，中文照念。
            # 以前异常直接往上抛，整句变 415，页面把整句跳过——
            # 中文书里夹一个 CPU 就丢一句话，是最不能接受的一种「降级」。
            try:
                pieces.append((_synth_en(seg, speed), 0.0))
            except NoEnVoice:
                continue
        else:
            pieces.append((_synth_zh(seg, voice, length_scale, SILENCE_SCALE), 0.0))
    if not pieces:
        raise NoEnVoice(text)
    if len(pieces) == 1:
        return pieces[0][0]
    return _join(pieces)


def _synth_one(text, voice, length_scale, silence_scale):
    """合成一个片段，带片段级缓存。常驻引擎优先，没有才退子进程。"""
    key = (voice, text, length_scale, silence_scale)
    with _cache_lock:
        if key in _seg_cache:
            _seg_cache.move_to_end(key)
            return _seg_cache[key]

    if has_latin(text) and en_ready():
        # 有英文模型：纯外文整段给英文模型，混排按语言切片
        data = (_synth_mixed(text, voice, length_scale) if has_han(text)
                else _synth_en(text, 1.0 / (length_scale or 1.0)))
    elif has_latin(text) and not has_han(text):
        # 纯外文但没装英文模型：交给页面用系统英文语音，别当引擎故障
        raise NoEnVoice('no english voice installed')
    else:
        # 中文（可能夹着几个英文词——没有英文模型时那些词只能丢，中文照常念）
        data = _synth_zh(text, voice, length_scale, silence_scale)

    with _cache_lock:
        _seg_cache[key] = data
        _seg_cache.move_to_end(key)
        while len(_seg_cache) > SEG_CACHE_MAX:
            _seg_cache.popitem(last=False)
    return data


def _synth_cli(text, voice, length_scale, silence_scale):
    """回退路径：起一次 sherpa-onnx-offline-tts.exe。每片段约 1.9 秒，只当兜底。"""
    exe = find_exe()
    if not exe:
        raise RuntimeError('engine missing: run 安装语音包.cmd first')
    _d, files = voice_files(voice)
    missing = [p for p in files if not os.path.isfile(p)]
    if missing:
        raise RuntimeError('model missing: ' + missing[0])

    with _sem:
        fd, out = tempfile.mkstemp(prefix='moyin_', suffix='.wav', dir=tempfile.gettempdir())
        os.close(fd)
        try:
            args = [exe] + build_args(voice, out, length_scale, silence_scale) + [text]
            kw = {}
            if os.name == 'nt':
                kw['creationflags'] = 0x08000000   # 不弹黑框
            r = subprocess.run(args, capture_output=True, timeout=90, **kw)
            if not os.path.isfile(out) or os.path.getsize(out) < 1000:
                err = (r.stderr or b'').decode('utf-8', 'ignore')[-300:]
                raise RuntimeError('synth failed rc=%s %s' % (r.returncode, err))
            with open(out, 'rb') as f:
                data = f.read()
        finally:
            try:
                os.remove(out)
            except OSError:
                pass
    return data


def _sayable(s):
    """有没有「念得出来」的字。

    小说里常出现整段只有标点的块：「？？？」「……」「——」。清洗后它们不是空字符串，
    但一个可发音的字都没有，引擎会抛 empty text。以前这种情况回 HTTP 500，
    页面收到就以为引擎坏了，直接切回系统朗读——听感上就是「念到问号忽然换了个人」。
    所以这种块别再当错误：给一段等长静音，页面照常往下念。
    """
    return any(ch.isalnum() for ch in (s or ''))


def _silence_wav(sec=0.30, sr=22050):
    """一段等长静音（WAV）。长度按「本来该念多久」估：一个问号约 0.3 秒。"""
    n = max(1, int(sr * max(0.12, min(1.2, sec))))
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(array.array('h', [0]) * n)
    return buf.getvalue()


def synth(text, voice, speed, dn=0):
    """切分 -> 并行合成 -> 按标点插停顿 -> 拼成一整段 ->（可选）男声降噪。

    dn: 0 原声 / 1 谱减 / 2 判决导向。只对男声生效，女声原样返回。
    失败抛 RuntimeError。
    """
    text = clean_text(text)
    if not _sayable(text):
        return _silence_wav(0.18 + 0.16 * min(4, len(text)))
    # 整段外文 + 没装英文模型：早早告诉页面换系统英文语音，别让它等一轮 500
    if has_latin(text) and not has_han(text) and not en_ready():
        raise NoEnVoice('no english voice installed')
    # 选了没装好的音色时，落到第一个可用音色，不打断听书
    if voice not in VOICES or not voice_ready(voice):
        voice = next((v for v in VOICES if voice_ready(v)), DEFAULT_VOICE)
    try:
        dn = int(dn)
    except (TypeError, ValueError):
        dn = 0
    if dn not in (1, 2) or _dn is None or not _dn.is_male(VOICES.get(voice)):
        dn = 0                                # 女声、非法值、模块缺失：一律不处理
    key = (voice, text, dn)
    with _cache_lock:
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key]

    units = merge_short(prosody_split(text))
    if not units:
        return _silence_wav()

    parts = _synth_units(units, voice)
    if not parts:
        raise RuntimeError('全部片段都没有出声')
    data = _join(parts)
    if dn:
        data = _dn.process_wav(data, dn)      # 内部已有 try/except，出错就返回原音频

    with _cache_lock:
        _cache[key] = data
        _cache.move_to_end(key)
        while len(_cache) > CACHE_MAX:
            _cache.popitem(last=False)
    return data


class Handler(BaseHTTPRequestHandler):
    server_version = 'MoYinTTS/1.0'
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *args):
        # 不记录任何朗读文本，只打印方法，避免隐私泄漏
        # /health 每 12 秒探一次、OPTIONS 只是预检，都不刷屏
        try:
            path = getattr(self, 'path', '') or ''
            if self.command == 'OPTIONS' or path.startswith('/health'):
                return
            print('[%s] %s %s' % (time.strftime('%H:%M:%S'), self.command, path), flush=True)
        except Exception:
            pass

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.send_header('Access-Control-Max-Age', '600')

    def _send(self, code, body, ctype='application/json; charset=utf-8'):
        if isinstance(body, str):
            body = body.encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self._cors()
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def do_OPTIONS(self):
        self._send(204, b'')

    def do_GET(self):
        p = self.path.split('?')[0].rstrip('/')
        if p in ('/health', ''):
            self._send(200, json.dumps(health(), ensure_ascii=False))
        elif p == '/warm':
            # 常驻模式下这次真的有意义：把三套实例都建起来（约 3~5 秒），
            # 页面在开头几句旁白还在播时叫一次，等角色第一次开口就已经热好了。
            # 1.14.39 起连配角库一起热：187 人也常驻了，不预热的话第一句对白要等
            # 9 秒左右（冷建池 + 和 fm 抢 CPU），预一下是 2.5 秒，且全在后台。
            if FAST:
                threading.Thread(target=warm_resident, kwargs={'which': 'fms'},
                                 daemon=True).start()
            self._send(200, json.dumps({'ok': True, 'lib': True, 'resident': FAST},
                                       ensure_ascii=False))
        else:
            self._send(404, json.dumps({'error': 'not found'}, ensure_ascii=False))

    def do_POST(self):
        path = self.path.split('?')[0].rstrip('/')
        if path != '/tts':
            self._send(404, json.dumps({'error': 'not found'}, ensure_ascii=False))
            return
        try:
            n = int(self.headers.get('Content-Length') or 0)
            if n <= 0 or n > 20000:
                raise ValueError('bad length')
            req = json.loads(self.rfile.read(n).decode('utf-8'))
        except Exception as e:
            self._send(400, json.dumps({'error': 'bad request: %s' % e}, ensure_ascii=False))
            return
        try:
            wav = synth(req.get('text'), req.get('voice') or DEFAULT_VOICE,
                        req.get('speed') or 1, req.get('dn') or 0)
            self._send(200, wav, 'audio/wav')
        except NoEnVoice:
            # 415 而不是 500：这不是「引擎坏了」，是「这一段是外文，本机没装英文模型」。
            # 页面收到 415 会改用系统英文语音念这一块，不弹错、不降级、不计失败。
            self._send(415, json.dumps({'error': 'no_en_voice'}, ensure_ascii=False))
        except subprocess.TimeoutExpired:
            self._send(503, json.dumps({'error': '合成超时'}, ensure_ascii=False))
        except Exception as e:
            self._send(500, json.dumps({'error': str(e)}, ensure_ascii=False))


def open_reader():
    """服务起来后自动用 Edge 打开阅读器；加 --no-open 可禁用。"""
    html = os.path.abspath(os.path.join(HERE, os.pardir, 'MoYinReader.html'))
    if not os.path.isfile(html):
        return
    cands = [
        os.path.join(os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)'),
                     'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        os.path.join(os.environ.get('ProgramFiles', r'C:\Program Files'),
                     'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    ]
    for e in cands:
        if os.path.isfile(e):
            try:
                subprocess.Popen([e, html], creationflags=0x08000000 if os.name == 'nt' else 0)
                return
            except Exception:
                pass
    try:
        import webbrowser
        webbrowser.open('file:///' + html.replace('\\', '/'))
    except Exception:
        pass


def main():
    st = health()
    print('=' * 52, flush=True)
    print('  墨吟 · 免费离线神经语音引擎', flush=True)
    print('=' * 52, flush=True)
    print('  端口     : http://127.0.0.1:%d (仅本机)' % PORT, flush=True)
    print('  引擎     : %s%s' % (st['engine'], '（常驻内存）' if st.get('resident') else '（逐句起进程）'), flush=True)
    print('  音色     : %d 个就绪 / 共 %d 个' % (st['count'], len(VOICES)), flush=True)
    for v in st['curated']:
        print('    %-10s %-20s %s' % (v, VOICES[v]['label'],
                                      '就绪' if st['voices'].get(v) else '缺失'), flush=True)
    if not st['ok']:
        print('\n  [!] 引擎或模型缺失，请先双击「安装语音包.cmd」', flush=True)
    else:
        print('\n  已就绪。切回阅读器，绿色「● 免费神经语音」即已连上。', flush=True)
    print('  关掉本窗口即停止服务（阅读器会自动退回系统语音）。\n', flush=True)
    if FAST:
        # 空格就是「模型常驻内存」，先把默认声线叫醒，第一句话不用等
        threading.Thread(target=warm_resident, kwargs={'which': 'f'}, daemon=True).start()
    if '--no-open' not in sys.argv:
        threading.Timer(0.6, open_reader).start()
    try:
        srv = QuietServer(('127.0.0.1', PORT), Handler)
        srv.daemon_threads = True
        srv.serve_forever()
    except OSError as e:
        print('  [!] 端口启动失败：%s' % e, flush=True)
        print('  可能已被占用。可改用别的端口：python tts_server.py 8188', flush=True)
        print('  并在阅读器「阅读设置 → 免费神经语音 → 端口」填同样的数字。', flush=True)
        if sys.stdin is not None and sys.stdin.isatty():
            input('按回车退出…')
    except KeyboardInterrupt:
        print('\n  已停止。', flush=True)


class QuietServer(ThreadingHTTPServer):
    """浏览器切段 / 关页时会主动断开连接，这属于正常现象，不该刷一屏 Python 堆栈。"""
    daemon_threads = True

    def handle_error(self, request, client_address):
        e = sys.exc_info()[1]
        if isinstance(e, (ConnectionResetError, ConnectionAbortedError, BrokenPipeError)):
            return
        ThreadingHTTPServer.handle_error(self, request, client_address)


if __name__ == '__main__':
    # PyInstaller --windowed 下 sys.stdout/stderr 是 None，print 会直接抛异常
    if sys.stdout is None:
        sys.stdout = open(os.devnull, 'w')
    if sys.stderr is None:
        sys.stderr = open(os.devnull, 'w')
    if os.name == 'nt':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
    main()
