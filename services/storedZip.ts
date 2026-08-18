export interface StoredZipEntry {
  name: string;
  data: Uint8Array;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let result = value;
  for (let bit = 0; bit < 8; bit += 1) {
    result = (result & 1) !== 0
      ? 0xEDB88320 ^ (result >>> 1)
      : result >>> 1;
  }
  return result >>> 0;
});

function crc32(data: Uint8Array): number {
  let value = 0xFFFFFFFF;
  for (const byte of data) {
    value = CRC_TABLE[(value ^ byte) & 0xFF] ^ (value >>> 8);
  }
  return (value ^ 0xFFFFFFFF) >>> 0;
}

function write16(view: DataView, offset: number, value: number): void {
  view.setUint16(offset, value, true);
}

function write32(view: DataView, offset: number, value: number): void {
  view.setUint32(offset, value >>> 0, true);
}

function concatenate(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

export function createStoredZip(entries: StoredZipEntry[]): Uint8Array {
  if (!entries.length) throw new Error("O arquivo compactado precisa ter conteúdo.");
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const checksum = crc32(entry.data);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    write32(localView, 0, 0x04034B50);
    write16(localView, 4, 20);
    write16(localView, 6, 0x0800);
    write16(localView, 8, 0);
    write16(localView, 10, 0);
    write16(localView, 12, 0);
    write32(localView, 14, checksum);
    write32(localView, 18, entry.data.length);
    write32(localView, 22, entry.data.length);
    write16(localView, 26, name.length);
    write16(localView, 28, 0);
    local.set(name, 30);
    localParts.push(local, entry.data);

    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    write32(centralView, 0, 0x02014B50);
    write16(centralView, 4, 20);
    write16(centralView, 6, 20);
    write16(centralView, 8, 0x0800);
    write16(centralView, 10, 0);
    write16(centralView, 12, 0);
    write16(centralView, 14, 0);
    write32(centralView, 16, checksum);
    write32(centralView, 20, entry.data.length);
    write32(centralView, 24, entry.data.length);
    write16(centralView, 28, name.length);
    write16(centralView, 30, 0);
    write16(centralView, 32, 0);
    write16(centralView, 34, 0);
    write16(centralView, 36, 0);
    write32(centralView, 38, 0);
    write32(centralView, 42, localOffset);
    central.set(name, 46);
    centralParts.push(central);
    localOffset += local.length + entry.data.length;
  }

  const centralDirectory = concatenate(centralParts);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  write32(endView, 0, 0x06054B50);
  write16(endView, 4, 0);
  write16(endView, 6, 0);
  write16(endView, 8, entries.length);
  write16(endView, 10, entries.length);
  write32(endView, 12, centralDirectory.length);
  write32(endView, 16, localOffset);
  write16(endView, 20, 0);
  return concatenate([...localParts, centralDirectory, end]);
}
