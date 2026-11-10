# -*- coding: utf-8 -*-
"""
墨吟阅读器 · 免费语音包安装器
================================
从 sherpa-onnx 官方 GitHub Release 下载开源引擎与中文神经语音模型，
解压到本目录的 engine/ 与 models/。全程免费、无需账号、无需 Key。

三套模型：
  models/xiaoya/model.onnx    女主「墨吟 · 女声」22.05 kHz（小雅，官方 int8）
  models/chaowen/model.onnx   男主「墨吟 · 男声」22.05 kHz（超文，官方 int8）
  models/fanchen/…            配角库 16 kHz，187 个说话人（fanchen-C）
  models/shared/…             两份 piper 模型共用的词表与数字规则

可选件（加 --en 才装，约 40 MB）：
  models/en-ljs/…             英文朗读模型（icefall vits-ljs，Apache-2.0）
                              不装也能听中文书，只是书里的英文词会念不出来

已装好的文件会自动跳过；换电脑时把整个 VoicePack 文件夹拷过去即可直接用。
下载走国内加速源，并对大文件做分段并发，避免单连接限速。

fanchen-C 官方只发 fp32（121 MB），安装器**原样使用，不做量化**。压缩过的
int8 版本虽然又快又小，但实测发音会糊（20 句字错率从 11% 升到 25%，耳朵里
就是「每句有几个字囫囵吞枣」），把声码器 / flow / 文本编码器分别保 fp32 都
救不回来——失真是整层累积的。想自己试压缩，见 QUANTIZE_LIB 开关。
⚠️ 另外千万别用 quantize_dynamic：卷积会变成 ConvInteger，onnxruntime CPU
对它只有参考实现，慢 20 倍，手机上就是每句等半分钟。
"""
import concurrent.futures
import io
import os
import random
import re
import shutil
import subprocess
import sys
import tarfile

HERE = os.path.dirname(os.path.abspath(__file__))
TMP = os.path.join(HERE, '_download_tmp')
# 直连优先：能自己连上就不把请求转给第三方（gh-proxy 会看到你的 IP）。直连失败才退到镜像。
GH = 'https://gh-proxy.com/https://github.com/k2-fsa/sherpa-onnx/releases/download/'
GH_DIRECT = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/'
# 英文模型不在 GitHub Release 上，走 HuggingFace；国内直连 huggingface.co 基本不通，
# 所以镜像优先、直连兜底（与其它包相反：那几个是直连优先）。
HF = 'https://hf-mirror.com/csukuangfj/vits-ljs/resolve/main/'
HF_DIRECT = 'https://huggingface.co/csukuangfj/vits-ljs/resolve/main/'

EXE = 'sherpa-onnx-offline-tts.exe'
ENGINE_DLL = ['onnxruntime.dll', 'onnxruntime_providers_shared.dll',
              'sherpa-onnx-c-api.dll', 'sherpa-onnx-cxx-api.dll']

# 每个包：(存档名, Release 相对路径, 包内根目录, [(包内相对路径, models/ 下目标相对路径)])
# 包内根目录留空表示自动在解压树里找；源文件找不到时也会按文件名递归搜一次。
PKGS = [
    ('engine.tar.bz2',
     'v2.0.1/sherpa-onnx-v2.0.1-win-x64-shared-MD-Release.tar.bz2',
     None, []),
    # 女主小雅：官方 int8（13.4 MB 压缩包）。词表与数字规则两个 piper 模型通用，取一份进 shared。
    ('v_xiaoya.tar.bz2',
     'tts-models/vits-piper-zh_CN-xiao_ya-medium-int8.tar.bz2',
     'vits-piper-zh_CN-xiao_ya-medium-int8',
     [('zh_CN-xiao_ya-medium.onnx', 'xiaoya/model.onnx'),
      ('lexicon.txt', 'shared/lexicon.txt'),
      ('tokens.txt', 'shared/tokens.txt'),
      ('date.fst', 'shared/date.fst'),
      ('number.fst', 'shared/number.fst'),
      ('phone.fst', 'shared/phone.fst')]),
    # 男主超文：同规格 22.05 kHz，只取模型本体。
    ('v_chaowen.tar.bz2',
     'tts-models/vits-piper-zh_CN-chaowen-medium-int8.tar.bz2',
     'vits-piper-zh_CN-chaowen-medium-int8',
     [('zh_CN-chaowen-medium.onnx', 'chaowen/model.onnx')]),
    # 配角库：187 个说话人共用一份模型，自带词表与 jieba 词典（多音字靠它）。
    ('v_fanchen.tar.bz2',
     'tts-models/vits-zh-hf-fanchen-C.tar.bz2',
     'vits-zh-hf-fanchen-C',
     [('lexicon.txt', 'fanchen/lexicon.txt'),
      ('tokens.txt', 'fanchen/tokens.txt'),
      ('dict/jieba.dict.utf8', 'fanchen/dict/jieba.dict.utf8'),
      ('dict/hmm_model.utf8', 'fanchen/dict/hmm_model.utf8'),
      ('dict/idf.utf8', 'fanchen/dict/idf.utf8'),
      ('dict/stop_words.utf8', 'fanchen/dict/stop_words.utf8'),
      ('dict/user.dict.utf8', 'fanchen/dict/user.dict.utf8')]),
]
FANCHEN_ONNX = 'fanchen/model.onnx'      # 单独处理：可能要量化
# 量化参数变了、或者决定不量化了，就把这个加一，老装法会自动重做。
MODEL_VER = 7

# ⚠️ 默认不量化。实测（`_asr_e2e.py`，20 句走完整链路，用 paraformer 反识别
# 算字错率）：原版 fp32 11~14%，任何 int8 量化版 23~26%——把声码器、flow、
# 文本编码器分别保 fp32 都救不回来，因为失真是整层累积的。24% 的字错率在耳朵里
# 就是「几乎每句都有几个字囫囵吞枣、听不清」。所以配角库只认原版 fp32，
# 多占 80 MB 换听得清。
QUANTIZE_LIB = False


def model_ver_ok():
    """models/fanchen 里那份模型是不是按当前参数做的。"""
    p = os.path.join(HERE, 'models', 'fanchen', '.model_ver')
    try:
        with open(p, encoding='utf-8') as f:
            return int((f.read() or '0').strip()) >= MODEL_VER
    except (OSError, ValueError):
        return False


def stamp_model_ver():
    try:
        d = os.path.join(HERE, 'models', 'fanchen')
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, '.model_ver'), 'w', encoding='utf-8') as f:
            f.write(str(MODEL_VER))
    except OSError:
        pass
PARTS = 8


def say(s):
    print(s, flush=True)


def engine_ok():
    b = os.path.join(HERE, 'engine', 'bin')
    return all(os.path.isfile(os.path.join(b, f)) for f in [EXE] + ENGINE_DLL)


def pkg_ok(name):
    """这一个包要落的文件是不是都在了。fanchen 的 model.onnx 不在 plan 里
    （要量化，单独装），所以额外判一下。"""
    if name == 'engine.tar.bz2':
        return engine_ok()
    pkg = [p for p in PKGS if p[0] == name][0]
    for _s, d in pkg[3]:
        if not os.path.isfile(os.path.join(HERE, 'models', os.sep.join(d.split('/')))):
            return False
    if name == 'v_fanchen.tar.bz2':
        return (os.path.isfile(os.path.join(HERE, 'models', 'fanchen', 'model.onnx'))
                and model_ver_ok())
    return True


def need():
    if not engine_ok():
        return True
    return any(not pkg_ok(p[0]) for p in PKGS)


def remote_size(rel):
    for base in (GH_DIRECT, GH):
        try:
            r = subprocess.run(['curl', '-sIL', '--max-time', '30', base + rel],
                               capture_output=True, text=True, timeout=40)
            nums = re.findall(r'(?im)^content-length:\s*(\d+)', r.stdout or '')
            if nums and int(nums[-1]) > 1000000:
                return int(nums[-1])
        except Exception:
            pass
    return 0


def part_job(job):
    i, start, end, rel, path = job
    want = end - start + 1
    if os.path.isfile(path) and os.path.getsize(path) == want:
        return i, True
    for attempt in range(3):
        for base in (GH_DIRECT, GH):
            try:
                r = subprocess.run(['curl', '-sSL', '--max-time', '600', '-r',
                                    '%d-%d' % (start, end), base + rel, '-o', path],
                                   timeout=630)
                rc = r.returncode
            except Exception:
                rc = -1
            got = os.path.getsize(path) if os.path.isfile(path) else 0
            if rc == 0 and got == want:
                return i, True
        try:
            os.remove(path)
        except OSError:
            pass
        say('    分段 %d 第 %d 次未完成，重试…' % (i, attempt + 1))
    return i, False


def curl(rel, out):
    """分段并发下载；拿不到长度时退回单连接断点续传。"""
    size = remote_size(rel)
    if size > 1000000:
        pdir = os.path.join(TMP, '.parts_' + os.path.basename(out).replace('.', '_'))
        os.makedirs(pdir, exist_ok=True)
        step = size // PARTS
        jobs = []
        for i in range(PARTS):
            a = i * step
            b = size - 1 if i == PARTS - 1 else a + step - 1
            jobs.append((i, a, b, rel, os.path.join(pdir, 'p%03d' % i)))
        say('    分段并发 ×%d，共 %d MB' % (PARTS, size // 1048576))
        with concurrent.futures.ThreadPoolExecutor(max_workers=PARTS) as ex:
            res = list(ex.map(part_job, jobs))
        if any(not ok for _i, ok in res):
            say('    [失败] 分段不完整：%s' % [i for i, ok in res if not ok])
            return False
        with io.open(out, 'wb') as w:
            for i, _ok in sorted(res):
                with io.open(os.path.join(pdir, 'p%03d' % i), 'rb') as f:
                    shutil.copyfileobj(f, w, 1 << 20)
        return os.path.getsize(out) == size
    for base in (GH_DIRECT, GH):
        for attempt in range(4):
            before = os.path.getsize(out) if os.path.isfile(out) else 0
            try:
                r = subprocess.run(['curl', '-sSL', '--max-time', '280', '-C', '-',
                                    base + rel, '-o', out], timeout=300)
                rc = r.returncode
            except Exception:
                rc = -1
            now = os.path.getsize(out) if os.path.isfile(out) else 0
            if rc == 0 and now > 1000000:
                return True
            if rc == 0 and now == before and now > 1000000:
                return True
            say('    单连接第 %d 次尝试（已有 %d 字节）…' % (attempt + 1, now))
    return os.path.isfile(out) and os.path.getsize(out) > 1000000


def extract(arc, out):
    with tarfile.open(arc, 'r:bz2') as t:
        try:
            t.extractall(out, filter='data')
        except TypeError:
            t.extractall(out)


def find_file(root, rel):
    """先按给定相对路径找，找不到就按文件名在整棵树里搜一次（兼容包内改名）。"""
    p = os.path.join(root, rel)
    if os.path.isfile(p):
        return p
    want = os.path.basename(rel)
    for dp, _dn, fn in os.walk(root):
        if want in fn:
            return os.path.join(dp, want)
    return None


def find_model(root):
    """名字对不上时，取整棵树里最大的 .onnx —— 那就是模型本体。"""
    best = None
    for dp, _dn, fn in os.walk(root):
        for f in fn:
            if f.endswith('.onnx'):
                p = os.path.join(dp, f)
                if not best or os.path.getsize(p) > os.path.getsize(best):
                    best = p
    return best


def quantize(src, dst):
    """fanchen 官方只发 fp32；有 onnxruntime 就压成 int8，省 80 MB 磁盘和一半内存。

    ⚠️ 必须用「静态量化 + QDQ」，不能用 `quantize_dynamic`。
    动态量化会把 189 个卷积一起变成 ConvInteger，而 onnxruntime 的 CPU
    provider 对 ConvInteger 只有参考实现（没走 MLAS 优化内核）——
    实测同一句话：fp32 0.66 秒，动态量化 int8 12.9 秒，慢 20 倍。
    手机上就是「每换一段等半分钟」。静态量化产出 QLinearConv，跑的是
    优化内核，实测 0.24 秒，比 fp32 还快。

    ⚠️ 但仍有一批节点必须留 fp32，否则重量化噪声会顺着声码器直接变成
    可听的「滋滋」底噪（实测谱平坦度 0.42，原版 0.15）：
      · /dec/conv_post      输出层，误差不经任何平滑就进波形
      · LeakyRelu / Tanh / Div  负半轴斜率 0.2，小信号被压成量化台阶
      · Add                 残差直通，噪声逐层累加
      · ConvTranspose       上采样，把低频噪声搬进高频
    把这些排掉以后平坦度回到 0.18、>6 kHz 能量与原版一致（3.2%），
    速度仍是 0.26 秒/句，体积 41 MB——体积换音质，这一档最划算。

    静态量化要标定数据：这里用 tokens.txt 里的音素 id 随机拼出 12 条
    8~36 音素的序列。解码器帧数由文本长度决定，所以激活范围能落在真实区间。
    """
    try:
        from onnxruntime.quantization import (CalibrationDataReader, CalibrationMethod,
                                              QuantFormat, QuantType, quantize_static)
        import numpy as np
    except Exception:
        return False, '没装 onnxruntime'
    try:
        tok = os.path.join(HERE, 'models', 'fanchen', 'tokens.txt')
        if not os.path.isfile(tok):
            return False, '缺 tokens.txt，没法做标定'
        n_tok = sum(1 for _ in open(tok, encoding='utf-8'))
        rnd = random.Random(20261110)

        def samples():
            for _ in range(12):
                L = rnd.choice([8, 12, 16, 22, 28, 36])
                yield {
                    'x': np.array([[rnd.randrange(n_tok) for _ in range(L)]], dtype=np.int64),
                    'x_length': np.array([L], dtype=np.int64),
                    'noise_scale': np.array([0.667], dtype=np.float32),
                    'length_scale': np.array([1.0], dtype=np.float32),
                    'noise_scale_w': np.array([0.8], dtype=np.float32),
                    'sid': np.array([rnd.randrange(0, 187)], dtype=np.int64),
                }

        class Reader(CalibrationDataReader):
            def __init__(self):
                self.it = iter(list(samples()))

            def get_next(self):
                return next(self.it, None)

        # 保音质的排除名单，见函数开头说明。
        try:
            import onnx
            keep_fp32 = [nd.name for nd in onnx.load(src).graph.node
                         if nd.name.startswith('/dec/conv_post')
                         or nd.op_type in ('LeakyRelu', 'Tanh', 'Div', 'Add', 'ConvTranspose')]
        except Exception:
            keep_fp32 = []

        say('    量化中（121 MB → 约 41 MB，通常 1~3 分钟）…')
        quantize_static(src, dst, calibration_data_reader=Reader(),
                        quant_format=QuantFormat.QDQ,
                        activation_type=QuantType.QUInt8,
                        weight_type=QuantType.QInt8,
                        per_channel=True,
                        calibrate_method=CalibrationMethod.MinMax,
                        nodes_to_exclude=keep_fp32)
    except Exception as e:
        return False, str(e)
    if not os.path.isfile(dst) or os.path.getsize(dst) > os.path.getsize(src) * 0.7:
        return False, '量化结果异常'
    return True, ''


def to_fp16(src, dst):
    """把 fp32 权重转成 fp16，体积减半而发音几乎不变——这是目前最划算的一档。

    为什么不用 int8：实测把合成音频喂给识别模型算字错率，
      fp32 原版 11~14%，int8（哪怕只压声码器/只压编码器）全都在 23~26%，
      听感就是「每句有几个字囫囵带过」。任何量化都会糊，只有不压才干净。
    fp16 则不同：它只砍指数位精度、保留动态范围，实测
      字错率 11.6%（vs 原版 11~14%）、合成 1.01 秒（vs 1.00 秒）、
      体积 121 MB → 61 MB。所以默认走这一档。

    需要 onnx 的 float16 转换器（onnxruntime 自带）；没装就原样复制 fp32。
    """
    try:
        import onnx
        from onnxruntime.transformers.float16 import convert_float_to_float16
    except Exception as e:
        return False, '没装 onnx/onnxruntime（%s）' % str(e)[:40]
    try:
        say('    转半精度（121 MB → 约 61 MB，通常 1~2 分钟）…')
        m = onnx.load(src)
        # keep_io_types：输入输出仍按 fp32 声明，引擎那边不用改一行代码。
        m2 = convert_float_to_float16(m, keep_io_types=True)
        onnx.save(m2, dst)
    except Exception as e:
        return False, str(e)[:80]
    if not os.path.isfile(dst) or os.path.getsize(dst) > os.path.getsize(src) * 0.7:
        return False, '转换结果异常'
    return True, ''


def install_en():
    """可选：装英文朗读模型（约 40 MB）。

    中文三套模型一个英文字母都不认识，书里夹的 iPhone / WiFi 会念不出来。
    这里装的是 icefall 的 vits-ljs（LJSpeech，22.05 kHz，Apache-2.0），
    自带 12.3 万条音素词典，**不需要 espeak**——piper 系模型要 espeak 前端，
    而 sherpa-onnx 2.0.1 的 Windows 包已经把 espeak 编掉了，装了也跑不起来。

    装完后 /health 里的 "en" 会变成 true，纯英文段落和混排里的英文词就有人念了。
    """
    dst_dir = os.path.join(HERE, 'models', 'en-ljs')
    files = [('vits-ljs.int8.onnx', 'model.onnx'), ('tokens.txt', 'tokens.txt'),
             ('lexicon.txt', 'lexicon.txt')]
    if all(os.path.isfile(os.path.join(dst_dir, d)) for _s, d in files):
        say('  英文语音已经装好了。')
        return True
    os.makedirs(dst_dir, exist_ok=True)
    say('\n  下载英文语音（约 40 MB，来自 HuggingFace 镜像）…')
    for src, d in files:
        out = os.path.join(dst_dir, d)
        if os.path.isfile(out) and os.path.getsize(out) > 1000:
            say('    已有：%s' % d)
            continue
        ok = False
        for base in (HF_DIRECT, HF):
            say('    %s ← %s' % (d, base.split('/')[2]))
            for _try in range(2):
                try:
                    r = subprocess.run(['curl', '-sSL', '--max-time', '900',
                                        base + src, '-o', out + '.part'],
                                       timeout=930)
                    if r.returncode == 0 and os.path.isfile(out + '.part') \
                            and os.path.getsize(out + '.part') > 1000:
                        os.replace(out + '.part', out)
                        ok = True
                        break
                except Exception:
                    pass
            if ok:
                break
        if not ok:
            say('    [失败] %s 没下完整，请检查网络后重跑。' % d)
            return False
        say('    完成：%s %.1f MB' % (d, os.path.getsize(out) / 1048576))
    say('  英文语音就绪。重开语音引擎后 /health 里的 "en" 会变成 true。')
    return True


def install():
    say('=' * 60)
    say('  墨吟 · 免费离线中文神经语音包')
    say('  引擎 sherpa-onnx (Apache-2.0)')
    say('  女主小雅 22.05 kHz ＋ 男主超文 22.05 kHz ＋ 187 人配角库 16 kHz')
    say('  全部开源免费，不注册、不联网听书、不按字数收费')
    say('=' * 60)
    if not need():
        say('\n语音库已经装好了，无需重复下载。')
        say('直接双击「启动语音引擎.cmd」即可。\n')
        return True
    os.makedirs(TMP, exist_ok=True)
    paths = {}
    for name, rel, _root, _plan in PKGS:
        if pkg_ok(name):
            say('  已完成：%s' % name)
            continue
        out = os.path.join(TMP, name)
        if os.path.isfile(out) and os.path.getsize(out) > 1000000:
            say('  已有存档：%s' % name)
            paths[name] = out
            continue
        say('\n  下载 %s …' % name)
        if not curl(rel, out):
            say('  [失败] 下载不完整，请检查网络后重新运行本脚本。')
            return False
        say('  完成：%.1f MB' % (os.path.getsize(out) / 1048576))
        paths[name] = out

    say('\n  解压并精简（只保留朗读需要的文件）…')
    if 'engine.tar.bz2' in paths:
        tmp_engine = os.path.join(TMP, 'engine_x')
        os.makedirs(tmp_engine, exist_ok=True)
        extract(paths['engine.tar.bz2'], tmp_engine)
        root = None
        for dp, _dn, fn in os.walk(tmp_engine):
            if EXE in fn:
                root = dp
                break
        if not root:
            say('  [失败] 引擎包里没找到 ' + EXE)
            return False
        lib = os.path.join(os.path.dirname(root), 'lib')
        bindst = os.path.join(HERE, 'engine', 'bin')
        os.makedirs(bindst, exist_ok=True)
        for f in [EXE] + ENGINE_DLL:
            src = os.path.join(root, f)
            if not os.path.isfile(src):
                src = os.path.join(lib, f)
            if os.path.isfile(src):
                shutil.copy2(src, os.path.join(bindst, f))

    fan_src = None
    for name, _rel, root_name, plan in PKGS:
        if name == 'engine.tar.bz2' or name not in paths:
            continue
        tmp = os.path.join(TMP, 'm_' + os.path.splitext(name)[0])
        os.makedirs(tmp, exist_ok=True)
        extract(paths[name], tmp)
        base = os.path.join(tmp, root_name) if root_name else tmp
        if not os.path.isdir(base):
            base = tmp
        for src_rel, dst_rel in plan:
            p = find_file(base, src_rel)
            if not p and src_rel.endswith('.onnx'):
                p = find_model(base)
            dst = os.path.join(HERE, 'models', dst_rel.replace('/', os.sep))
            if not p:
                say('  [注意] 包里没找到 %s，跳过' % src_rel)
                continue
            parent = os.path.dirname(dst)
            if parent and not os.path.isdir(parent):
                os.makedirs(parent, exist_ok=True)
            shutil.copy2(p, dst)
        if name == 'v_fanchen.tar.bz2':
            fan_src = find_file(base, 'model.onnx')

    # fanchen 的模型本体。默认转 fp16（61 MB，发音与 fp32 几乎无差）；
    # 转不了就放原版 fp32（121 MB）。量化版实测发音会糊，见 QUANTIZE_LIB 说明。
    fan_dst = os.path.join(HERE, 'models', FANCHEN_ONNX.replace('/', os.sep))
    if fan_src and (not os.path.isfile(fan_dst) or not model_ver_ok()):
        if os.path.isfile(fan_dst) and not model_ver_ok():
            say('    检测到旧版语音库（压缩过的模型发音发糊），换成半精度版…')
        os.makedirs(os.path.dirname(fan_dst), exist_ok=True)
        ok, why = False, ''
        if not QUANTIZE_LIB:
            tmp16 = fan_dst + '.f16'
            ok, why = to_fp16(fan_src, tmp16)
            if ok:
                os.replace(tmp16, fan_dst)
                say('    半精度完成：%.1f MB' % (os.path.getsize(fan_dst) / 1048576))
            else:
                try:
                    os.remove(tmp16)
                except OSError:
                    pass
        if not ok and QUANTIZE_LIB:
            tmp_i8 = fan_dst + '.i8'
            ok, why = quantize(fan_src, tmp_i8)
            if ok:
                os.replace(tmp_i8, fan_dst)
                say('    量化完成：%.1f MB' % (os.path.getsize(fan_dst) / 1048576))
            else:
                try:
                    os.remove(tmp_i8)
                except OSError:
                    pass
        if not ok:
            shutil.copy2(fan_src, fan_dst)
            say('    保留原版 fp32：%.1f MB（%s）'
                % (os.path.getsize(fan_dst) / 1048576, why or '已关闭半精度'))
        stamp_model_ver()

    try:
        shutil.rmtree(TMP)
    except OSError:
        pass
    ok = not need()
    say('\n  ' + ('安装完成。' if ok else '[注意] 部分文件仍缺失，请重新运行一次。'))
    if ok:
        say('  下一步：双击「启动语音引擎.cmd」，会自动打开阅读器。')
        say('  想让它连英文单词也念，重跑本脚本时加参数 --en（再下 40 MB）。')
    say('')
    return ok


if __name__ == '__main__':
    if os.name == 'nt':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
    # 加 --en 就顺带装英文语音（可选件，缺了不影响中文朗读）
    ok = install()
    if ok and '--en' in sys.argv:
        ok = install_en()
    sys.exit(0 if ok else 1)
