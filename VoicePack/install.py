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

已装好的文件会自动跳过；换电脑时把整个 VoicePack 文件夹拷过去即可直接用。
下载走国内加速源，并对大文件做分段并发，避免单连接限速。

fanchen-C 官方只发 fp32（121 MB）。若本机装了 onnxruntime，安装器会自动量化成
int8（约 38 MB）；没装就保留 fp32——能听，只是多占 80 MB。手动量化见文末提示。
"""
import concurrent.futures
import io
import os
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
        return os.path.isfile(os.path.join(HERE, 'models', 'fanchen', 'model.onnx'))
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
    """fanchen 官方只发 fp32；有 onnxruntime 就压成 int8，省 80 MB 磁盘和一半内存。"""
    try:
        from onnxruntime.quantization import quantize_dynamic, QuantType
    except Exception:
        return False, '没装 onnxruntime'
    try:
        say('    量化中（121 MB → 约 38 MB，通常 1~2 分钟）…')
        quantize_dynamic(src, dst, weight_type=QuantType.QInt8)
    except Exception as e:
        return False, str(e)
    if not os.path.isfile(dst) or os.path.getsize(dst) > os.path.getsize(src) * 0.7:
        return False, '量化结果异常'
    return True, ''


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

    # fanchen 的模型本体：先试量化，成功就只留 int8
    fan_dst = os.path.join(HERE, 'models', FANCHEN_ONNX.replace('/', os.sep))
    if fan_src and not os.path.isfile(fan_dst):
        os.makedirs(os.path.dirname(fan_dst), exist_ok=True)
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
            shutil.copy2(fan_src, fan_dst)
            say('    保留 fp32（%s）。想省 80 MB 可以装好 onnxruntime 后重跑本脚本。' % why)

    try:
        shutil.rmtree(TMP)
    except OSError:
        pass
    ok = not need()
    say('\n  ' + ('安装完成。' if ok else '[注意] 部分文件仍缺失，请重新运行一次。'))
    if ok:
        say('  下一步：双击「启动语音引擎.cmd」，会自动打开阅读器。')
    say('')
    return ok


if __name__ == '__main__':
    if os.name == 'nt':
        try:
            sys.stdout.reconfigure(encoding='utf-8')
        except Exception:
            pass
    sys.exit(0 if install() else 1)
