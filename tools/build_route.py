#!/usr/bin/env python3
"""国土数値情報 鉄道データ (N02) から 東京→博多 の新幹線ルートを生成する。

使い方:
  python3 tools/build_route.py <N02_RailroadSection.geojson> <N02_Station.geojson> tools/landmarks.csv > js/route-data.js

出典: 国土交通省 国土数値情報（鉄道データ）
  https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N02-v2_3.html

出力内容:
  - 線路中心線 (100m 間隔, 平滑化済み, 平面直角メートル座標)
  - 各駅の距離 (実測し、東京-新大阪 515.4km / 新大阪-博多 553.7km の実キロに合わせて補正)
  - 沿線の市街地密度 (周囲の在来線駅数から算出, 500m 間隔)
"""
import heapq
import json
import math
import sys

R = 6371008.8
LAT0, LON0 = 34.6, 135.0  # 投影の中心
LINES = ("東海道新幹線", "山陽新幹線")
# 公表されている実キロ
KM_TOKYO_SHINOSAKA = 515.4
KM_SHINOSAKA_HAKATA = 553.7

STATION_ORDER = [
    "東京", "品川", "新横浜", "小田原", "熱海", "三島", "新富士", "静岡", "掛川",
    "浜松", "豊橋", "三河安城", "名古屋", "岐阜羽島", "米原", "京都", "新大阪",
    "新神戸", "西明石", "姫路", "相生", "岡山", "新倉敷", "福山", "新尾道", "三原",
    "東広島", "広島", "新岩国", "徳山", "新山口", "厚狭", "新下関", "小倉", "博多",
]
STATION_KANA = {
    "東京": "とうきょう", "品川": "しながわ", "新横浜": "しんよこはま", "小田原": "おだわら",
    "熱海": "あたみ", "三島": "みしま", "新富士": "しんふじ", "静岡": "しずおか",
    "掛川": "かけがわ", "浜松": "はままつ", "豊橋": "とよはし", "三河安城": "みかわあんじょう",
    "名古屋": "なごや", "岐阜羽島": "ぎふはしま", "米原": "まいばら", "京都": "きょうと",
    "新大阪": "しんおおさか", "新神戸": "しんこうべ", "西明石": "にしあかし", "姫路": "ひめじ",
    "相生": "あいおい", "岡山": "おかやま", "新倉敷": "しんくらしき", "福山": "ふくやま",
    "新尾道": "しんおのみち", "三原": "みはら", "東広島": "ひがしひろしま", "広島": "ひろしま",
    "新岩国": "しんいわくに", "徳山": "とくやま", "新山口": "しんやまぐち", "厚狭": "あさ",
    "新下関": "しんしものせき", "小倉": "こくら", "博多": "はかた",
}
STATION_EN = {
    "東京": "Tokyo", "品川": "Shinagawa", "新横浜": "Shin-Yokohama", "小田原": "Odawara",
    "熱海": "Atami", "三島": "Mishima", "新富士": "Shin-Fuji", "静岡": "Shizuoka",
    "掛川": "Kakegawa", "浜松": "Hamamatsu", "豊橋": "Toyohashi", "三河安城": "Mikawa-Anjo",
    "名古屋": "Nagoya", "岐阜羽島": "Gifu-Hashima", "米原": "Maibara", "京都": "Kyoto",
    "新大阪": "Shin-Osaka", "新神戸": "Shin-Kobe", "西明石": "Nishi-Akashi", "姫路": "Himeji",
    "相生": "Aioi", "岡山": "Okayama", "新倉敷": "Shin-Kurashiki", "福山": "Fukuyama",
    "新尾道": "Shin-Onomichi", "三原": "Mihara", "東広島": "Higashi-Hiroshima", "広島": "Hiroshima",
    "新岩国": "Shin-Iwakuni", "徳山": "Tokuyama", "新山口": "Shin-Yamaguchi", "厚狭": "Asa",
    "新下関": "Shin-Shimonoseki", "小倉": "Kokura", "博多": "Hakata",
}


def haversine(a, b):
    la1, la2 = math.radians(a[1]), math.radians(b[1])
    dl = math.radians(b[0] - a[0])
    h = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def project(lon, lat):
    """経緯度 → 平面メートル座標 (x: 東, y: 北)"""
    x = math.radians(lon - LON0) * R * math.cos(math.radians(lat))
    y = math.radians(lat - LAT0) * R
    return x, y


def key(p):
    return (round(p[0], 5), round(p[1], 5))


def build_path(features, start, goal):
    graph = {}
    for i, ft in enumerate(features):
        c = ft["geometry"]["coordinates"]
        length = sum(haversine(c[j], c[j + 1]) for j in range(len(c) - 1))
        a, b = key(c[0]), key(c[-1])
        graph.setdefault(a, []).append((b, length, i, False))
        graph.setdefault(b, []).append((a, length, i, True))

    def nearest(p):
        return min(graph, key=lambda n: haversine(n, p))

    s, g = nearest(start), nearest(goal)
    dist, prev = {s: 0}, {}
    pq = [(0, s)]
    while pq:
        d, n = heapq.heappop(pq)
        if n == g:
            break
        if d > dist.get(n, 1e18):
            continue
        for m, length, i, rev in graph[n]:
            nd = d + length
            if nd < dist.get(m, 1e18):
                dist[m] = nd
                prev[m] = (n, i, rev)
                heapq.heappush(pq, (nd, m))
    seq = []
    n = g
    while n != s:
        p, i, rev = prev[n]
        seq.append((i, rev))
        n = p
    seq.reverse()
    coords = []
    for i, rev in seq:
        c = features[i]["geometry"]["coordinates"]
        if rev:
            c = c[::-1]
        coords.extend(c if not coords else c[1:])
    return coords


def resample(pts, step):
    """平面座標の折れ線を等間隔に再サンプリング"""
    out = [pts[0]]
    acc = 0.0
    carry = 0.0
    for i in range(len(pts) - 1):
        (x0, y0), (x1, y1) = pts[i], pts[i + 1]
        seg = math.hypot(x1 - x0, y1 - y0)
        if seg == 0:
            continue
        t = step - carry
        while t <= seg:
            out.append((x0 + (x1 - x0) * t / seg, y0 + (y1 - y0) * t / seg))
            t += step
        carry = seg - (t - step)
        acc += seg
    out.append(pts[-1])
    return out


def smooth(pts, half):
    """移動平均で平滑化 (両端は固定)"""
    n = len(pts)
    sx = [0.0] * (n + 1)
    sy = [0.0] * (n + 1)
    for i, (x, y) in enumerate(pts):
        sx[i + 1] = sx[i] + x
        sy[i + 1] = sy[i] + y
    out = []
    for i in range(n):
        h = min(half, i, n - 1 - i)
        a, b = i - h, i + h + 1
        out.append(((sx[b] - sx[a]) / (b - a), (sy[b] - sy[a]) / (b - a)))
    return out


def main():
    sections = json.load(open(sys.argv[1], encoding="utf-8"))["features"]
    stations_all = json.load(open(sys.argv[2], encoding="utf-8"))["features"]
    features = [f for f in sections if f["properties"]["路線名"] in LINES]

    st_coord = {}
    for f in stations_all:
        p = f["properties"]
        if p["路線名"] in LINES:
            c = f["geometry"]["coordinates"]
            st_coord[p["駅名"]] = c[len(c) // 2]

    coords = build_path(features, st_coord["東京"], st_coord["博多"])
    pts = [project(*c) for c in coords]

    # 25m で再サンプリング → 平滑化 (半径 ~250m) → 2回目の平滑化で曲率を滑らかに
    fine = resample(pts, 25.0)
    fine = smooth(fine, 10)
    fine = smooth(fine, 10)
    cum = [0.0]
    for i in range(1, len(fine)):
        cum.append(cum[-1] + math.hypot(fine[i][0] - fine[i - 1][0], fine[i][1] - fine[i - 1][1]))

    def locate(lon, lat):
        x, y = project(lon, lat)
        best = min(range(0, len(fine), 4), key=lambda i: (fine[i][0] - x) ** 2 + (fine[i][1] - y) ** 2)
        lo, hi = max(0, best - 8), min(len(fine), best + 9)
        best = min(range(lo, hi), key=lambda i: (fine[i][0] - x) ** 2 + (fine[i][1] - y) ** 2)
        return cum[best]

    st_s = {name: locate(*st_coord[name]) for name in STATION_ORDER}
    st_s["東京"] = 0.0
    st_s["博多"] = cum[-1]

    # 実測距離 → 実キロ への換算 (区間ごとに線形)
    s_osaka = st_s["新大阪"]
    k1 = KM_TOKYO_SHINOSAKA * 1000 / s_osaka
    k2 = KM_SHINOSAKA_HAKATA * 1000 / (cum[-1] - s_osaka)
    sys.stderr.write(
        f"geometry length {cum[-1]/1000:.1f} km (Tokyo-ShinOsaka {s_osaka/1000:.1f}, "
        f"ShinOsaka-Hakata {(cum[-1]-s_osaka)/1000:.1f}) scale {k1:.4f}/{k2:.4f}\n"
    )

    # 実キロ (メートル) を基準にした 100m 間隔の中心線を出力
    def s_to_km(s):
        return s * k1 if s <= s_osaka else KM_TOKYO_SHINOSAKA * 1000 + (s - s_osaka) * k2

    total_km = KM_TOKYO_SHINOSAKA + KM_SHINOSAKA_HAKATA
    step = 100.0
    out_xy = []
    j = 0
    kms = [s_to_km(s) for s in cum]
    n_out = int(total_km * 1000 / step) + 1
    for n in range(n_out):
        target = min(n * step, kms[-1])
        while j < len(kms) - 2 and kms[j + 1] < target:
            j += 1
        t = (target - kms[j]) / max(1e-9, kms[j + 1] - kms[j])
        t = max(0.0, min(1.0, t))
        # 実キロと幾何長の比で縮尺を合わせ、ゲーム内の距離 = 実キロ にする
        x = fine[j][0] + (fine[j + 1][0] - fine[j][0]) * t
        y = fine[j][1] + (fine[j + 1][1] - fine[j][1]) * t
        out_xy.append((x, y))

    # 縮尺補正: 中心線の点間隔が step (=100m) になるよう向きを保ったまま再積分
    rebuilt = [out_xy[0]]
    for i in range(1, len(out_xy)):
        dx = out_xy[i][0] - out_xy[i - 1][0]
        dy = out_xy[i][1] - out_xy[i - 1][1]
        d = math.hypot(dx, dy) or 1.0
        px, py = rebuilt[-1]
        rebuilt.append((px + dx / d * step, py + dy / d * step))

    stations = []
    for name in STATION_ORDER:
        stations.append({
            "name": name,
            "kana": STATION_KANA[name],
            "en": STATION_EN[name],
            "km": round(s_to_km(st_s[name]) / 1000, 1),
        })
    stations[-1]["km"] = round(total_km, 1)

    # 市街地密度: 線路から 3km 以内にある (新幹線以外の) 駅の数
    others = [project(*f["geometry"]["coordinates"][0]) for f in stations_all
              if f["properties"]["路線名"] not in LINES]
    grid = {}
    cell = 3000.0
    for (x, y) in others:
        grid.setdefault((int(x // cell), int(y // cell)), []).append((x, y))
    density = []
    for i in range(0, len(fine), 20):  # 500m 間隔
        x, y = fine[i]
        gx, gy = int(x // cell), int(y // cell)
        c = 0
        for ix in range(gx - 1, gx + 2):
            for iy in range(gy - 1, gy + 2):
                for (ox, oy) in grid.get((ix, iy), ()):
                    if (ox - x) ** 2 + (oy - y) ** 2 < cell * cell:
                        c += 1
        density.append((s_to_km(cum[i]) / 1000, c))
    # 実キロ 0.5km 間隔に揃える
    dens_out = []
    j = 0
    for n in range(int(total_km * 2) + 1):
        km = n * 0.5
        while j < len(density) - 2 and density[j + 1][0] < km:
            j += 1
        dens_out.append(min(60, density[j][1]))

    # 地物: 経緯度 → (km, 左右オフセット[m], 左が正)
    landmarks = []
    if len(sys.argv) > 3:
        for line in open(sys.argv[3], encoding="utf-8"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            name, lat, lon, kind, label = line.split(",")[:5]
            x, y = project(float(lon), float(lat))
            best = min(range(len(fine)), key=lambda i: (fine[i][0] - x) ** 2 + (fine[i][1] - y) ** 2)
            i0, i1 = max(0, best - 1), min(len(fine) - 1, best + 1)
            tx, ty = fine[i1][0] - fine[i0][0], fine[i1][1] - fine[i0][1]
            tl = math.hypot(tx, ty) or 1.0
            off = ((x - fine[best][0]) * -ty + (y - fine[best][1]) * tx) / tl
            km = s_to_km(cum[best]) / 1000
            landmarks.append({"name": label, "type": kind, "km": round(km, 2), "off": round(off)})
            sys.stderr.write(f"{label}: {km:.1f} km, offset {off:+.0f} m\n")
        landmarks.sort(key=lambda l: l["km"])

    data = {
        "source": "国土数値情報（鉄道データ）N02-19 国土交通省",
        "stepM": step,
        "totalKm": round(total_km, 1),
        "xy": [round(v, 1) for p in rebuilt for v in p],
        "stations": stations,
        "density": dens_out,
        "landmarks": landmarks,
    }
    sys.stdout.write("// 自動生成: tools/build_route.py (出典: 国土数値情報 鉄道データ N02-19 国土交通省)\n")
    sys.stdout.write("export const ROUTE = ")
    json.dump(data, sys.stdout, ensure_ascii=False, separators=(",", ":"))
    sys.stdout.write(";\n")


if __name__ == "__main__":
    main()
