"""把 xwd 抓到的 X11 画面转成 PNG。

信创机器上常常没有 ImageMagick，又不想为了截一张图去装东西，
所以这里直接解析 XWD 格式再自己拼 PNG——只用标准库。

    DISPLAY=:0 xwd -root -silent -out /tmp/a.xwd
    python3 xwd2png.py /tmp/a.xwd /tmp/a.png
"""
import struct
import sys
import zlib


def read_xwd(path):
    data = open(path, 'rb').read()
    (header_size, _ver, _fmt, _depth, w, h, _xoff, byte_order,
     _bmunit, _bmbo, _bmpad, bpp, bpl, _vclass,
     _rmask, _gmask, _bmask, _bprgb, _ncmap, ncolors,
     _ww, _wh, _wx, _wy, _bdr) = struct.unpack('>25I', data[:100])

    off = header_size + ncolors * 12
    px = data[off:]
    # X 服务器常把 24 位色按 32 位对齐（bpp 报 24，但每像素实占 4 字节），
    # 所以按「每行字节数 / 宽度」反推才是准的。
    step = (bpl // w) if w else max(1, bpp // 8)
    if step < 1:
        step = max(1, bpp // 8)

    rows = []
    if len(px) >= h * bpl:
        # xwd 默认不压缩：整块 raw，每行 bpl 字节，没有行标志字节
        for y in range(h):
            rows.append(px[y * bpl:(y + 1) * bpl])
        return w, h, step, byte_order, rows

    # 少数情况用了 -rle：每行开头一个标志字节
    p = 0
    for _y in range(h):
        if p >= len(px):
            break
        flag = px[p]
        p += 1
        row = bytearray(bpl)
        if flag == 0:                      # 该行未压缩
            row[:] = px[p:p + bpl]
            p += bpl
        else:                              # 行内 RLE：像素 + 重复次数
            i = 0
            while i < bpl and p + step < len(px):
                pixel = px[p:p + step]
                p += step
                cnt = px[p]
                p += 1
                for _k in range(cnt):
                    if i + step > bpl:
                        break
                    row[i:i + step] = pixel
                    i += step
        rows.append(bytes(row))
    return w, h, step, byte_order, rows


def to_rgba(w, h, step, byte_order, rows):
    out = []
    for row in rows:
        line = bytearray(w * 4)
        for x in range(w):
            s = x * step
            b0, b1, b2 = row[s], row[s + 1], row[s + 2]
            if byte_order == 0:            # LSBFirst：字节序是 B,G,R
                r, g, b = b2, b1, b0
            else:                          # MSBFirst
                r, g, b = b0, b1, b2
            line[x * 4:x * 4 + 4] = bytes((r, g, b, 255))
        out.append(bytes(line))
    return out


def write_png(path, w, h, rgba_rows):
    raw = b''.join(b'\x00' + r for r in rgba_rows)

    def chunk(tag, payload):
        return (struct.pack('>I', len(payload)) + tag + payload +
                struct.pack('>I', zlib.crc32(tag + payload) & 0xffffffff))

    ihdr = struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)
    blob = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) +
            chunk(b'IDAT', zlib.compress(raw, 6)) + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(blob)


def main():
    if len(sys.argv) < 3:
        print('用法: xwd2png.py 输入.xwd 输出.png')
        return 2
    w, h, step, bo, rows = read_xwd(sys.argv[1])
    write_png(sys.argv[2], w, h, to_rgba(w, h, step, bo, rows))
    print('%dx%d -> %s' % (w, h, sys.argv[2]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
