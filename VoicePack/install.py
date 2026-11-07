# -*- coding: utf-8 -*-
"""
墨吟阅读器 · 免费语音包安装器
================================
从 sherpa-onnx 官方 GitHub Release 下载开源引擎与中文神经语音模型，
解压到本目录的 engine/ 与 models/。全程免费、无需账号、无需 Key。

已装好的文件会自动跳过；换电脑时把整个 VoicePack 文件夹拷过去即可直接用。
下载走国内加速源，并对大文件做分段并发，避免单连接限速。
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
GH = 'https://gh-proxy.com/https://github.com/k2-fsa/sherpa-onnx/releases/download/'
GH_DIRECT = 'https://github.com/k2-fsa/sherpa-onnx/releases/download/'

EXE = 'sherpa-onnx-offline-tts.exe'
ENGINE_DLL = ['onnxruntime.dll', 'onnxruntime_providers_shared.dll',
              'sherpa-onnx-c-api.dll', 'sherpa-onnx-cxx-api.dll']

# 只用一份 AISHELL3 多说话人模型（174 个声线共用）。
# 包里有个 172 MB 的 rule.far 规则文件，朗读不需要，只取小文件。
AISHELL3_FILES = ['model.onnx', 'tokens.txt', 'lexicon.txt',
                  'date.fst', 'number.fst', 'phone.fst']

# (本地存档名, 官方相对路径, 包内子目录, 目标目录, 要拷出的文件, 类型)
ARCS = [
    ('engine.tar.bz2', 'v2.0.1/sherpa-onnx-v2.0.1-win-x64-shared-MD-Release.tar.bz2',
     None, None, [], 'engine'),
    ('voice_aishell3.tar.bz2', 'tts-models/vits-icefall-zh-aishell3.tar.bz2',
     'vits-icefall-zh-aishell3', 'aishell3', AISHELL3_FILES, 'model'),
]
PARTS = 8


def say(s):
    print(s, flush=True)


def engine_ok():
    b = os.path.join(HERE, 'engine', 'bin')
    return all(os.path.isfile(os.path.join(b, f)) for f in [EXE] + ENGINE_DLL)


def model_ok(dst, files):
    d = os.path.join(HERE, 'models', dst)
    return all(os.path.isfile(os.path.join(d, f)) for f in files)


def need():
    if not engine_ok():
        return True
    for a in ARCS:
        if a[5] in ('model', 'raw') and not model_ok(a[3], a[4]):
            return True
    return False


def remote_size(rel):
    for base in (GH, GH_DIRECT):
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
        for base in (GH, GH_DIRECT):
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
    for base in (GH, GH_DIRECT):
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


def install():
    say('=' * 56)
    say('  墨吟 · 免费离线中文神经语音包')
    say('  引擎 sherpa-onnx (Apache-2.0) + AISHELL3（174 个声线，约 55 MB）')
    say('  全部开源免费，不注册、不联网听书、不按字数收费')
    say('=' * 56)
    if not need():
        say('\n语音库已经装好了，无需重复下载。')
        say('直接双击「启动语音引擎.cmd」即可。\n')
        return True
    os.makedirs(TMP, exist_ok=True)
    paths = {}
    for name, rel, _sub, dst, files, kind in ARCS:
        if kind == 'engine' and engine_ok():
            continue
        if kind in ('model', 'raw') and model_ok(dst, files):
            say('  已完成：%s' % dst)
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

    for name, _rel, sub, dst, files, kind in ARCS:
        if kind == 'raw':
            target = os.path.join(HERE, 'models', dst)
            os.makedirs(target, exist_ok=True)
            shutil.copy2(paths[name], os.path.join(target, os.path.basename(name)))
            continue
        if kind != 'model' or name not in paths:
            continue
        tmp_model = os.path.join(TMP, 'm_' + dst)
        os.makedirs(tmp_model, exist_ok=True)
        extract(paths[name], tmp_model)
        src = os.path.join(tmp_model, sub)
        if not os.path.isdir(src):
            cands = [os.path.join(dp, sub) for dp, dn, _fn in os.walk(tmp_model) if sub in dn]
            src = cands[0] if cands else src
        target = os.path.join(HERE, 'models', dst)
        os.makedirs(target, exist_ok=True)
        for f in files:
            p = os.path.join(src, f)
            if os.path.isfile(p):
                shutil.copy2(p, os.path.join(target, f))

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
