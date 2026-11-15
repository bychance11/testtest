/**
 * JPEG Blob 의 JFIF APP0 밀도 필드를 dpi 로 설정.
 * 캔버스 출력 JPEG 는 보통 FFD8 FFE0(JFIF) 로 시작. 없으면 APP0 를 삽입.
 * 대부분 키오스크는 비율(2:3)만 보지만, 포토샵/일부 인화 소프트웨어는 이 값으로 4x6 을 인식.
 */
export async function withDpi(blob: Blob, dpi: number): Promise<Blob> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return blob;

  // 기존 APP0 JFIF 찾기 (SOI 바로 뒤)
  if (buf[2] === 0xff && buf[3] === 0xe0 && buf[6] === 0x4a && buf[7] === 0x46 && buf[8] === 0x49 && buf[9] === 0x46) {
    const out = buf.slice();
    out[13] = 1;                               // units: 1 = dots per inch
    out[14] = (dpi >> 8) & 0xff; out[15] = dpi & 0xff;
    out[16] = (dpi >> 8) & 0xff; out[17] = dpi & 0xff;
    return new Blob([out], { type: "image/jpeg" });
  }

  // APP0 없음 → 삽입 (길이 16)
  const app0 = new Uint8Array([
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
    0x01, (dpi >> 8) & 0xff, dpi & 0xff, (dpi >> 8) & 0xff, dpi & 0xff, 0x00, 0x00,
  ]);
  const out = new Uint8Array(buf.length + app0.length);
  out.set(buf.subarray(0, 2), 0);
  out.set(app0, 2);
  out.set(buf.subarray(2), 2 + app0.length);
  return new Blob([out], { type: "image/jpeg" });
}
