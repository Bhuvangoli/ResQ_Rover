"""
ResQ Rover — Camera UDP simulator.

Reads a JPEG file (or generates a synthetic one), splits it into packets
using the exact same 20-byte header the ESP32-CAM firmware uses, and
broadcasts the packets to the PC's LAN broadcast address on UDP port 4210.

Use this to verify the full pipeline — UDP reception, packet parsing,
frame reassembly, MJPEG endpoint, and dashboard display — before connecting
physical hardware.

Usage
-----
  # From the ResQ_Rover root directory:
  python tools/camera_sim.py                        # synthetic gradient JPEG
  python tools/camera_sim.py --image path/to/frame.jpg
  python tools/camera_sim.py --fps 10 --port 4210 --host 255.255.255.255

Requirements
------------
  pip install Pillow        # only needed when generating synthetic frames
  # No extra packages needed when --image is supplied (uses stdlib only)

Packet header (little-endian, 20 bytes — must match firmware exactly)
----------------------------------------------------------------------
  uint32  magic         0x52514356
  uint8   version       1
  uint8   flags         0
  uint16  header_size   20
  uint32  frame_id      increments each frame
  uint16  packet_index  0-based
  uint16  packet_count  total packets in this frame
  uint32  frame_length  total JPEG bytes
"""
from __future__ import annotations

import argparse
import io
import socket
import struct
import time

MAGIC        = 0x52514356
VERSION      = 1
FLAGS        = 0
HEADER       = struct.Struct("<IBBHIHHI")
HEADER_SIZE  = HEADER.size          # must be 20
assert HEADER_SIZE == 20

PAYLOAD_SIZE = 1180                 # bytes of JPEG per packet
DEFAULT_PORT = 4210
DEFAULT_HOST = "255.255.255.255"
DEFAULT_FPS  = 10


# ---------------------------------------------------------------------------
# Synthetic JPEG generator (used when no --image is provided)
# ---------------------------------------------------------------------------

def _synthetic_jpeg(frame_id: int, width: int = 320, height: int = 240) -> bytes:
    """Generate a simple gradient JPEG using Pillow, labelled with frame_id."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        raise SystemExit(
            "Pillow is required for synthetic frames.\n"
            "Install it:  pip install Pillow\n"
            "Or supply a JPEG with:  --image path/to/frame.jpg"
        )

    img = Image.new("RGB", (width, height))
    pixels = img.load()
    r_base = (frame_id * 7) % 256
    for y in range(height):
        for x in range(width):
            pixels[x, y] = (
                (r_base + x) % 256,
                (y * 2) % 256,
                (frame_id % 256),
            )

    draw = ImageDraw.Draw(img)
    draw.text((8, 8), f"frame {frame_id}", fill=(255, 255, 255))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=70)
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Packet builder
# ---------------------------------------------------------------------------

def _build_packets(frame_id: int, jpeg: bytes) -> list[bytes]:
    """Split a JPEG into UDP datagrams using the firmware header format."""
    chunks = [jpeg[i:i + PAYLOAD_SIZE] for i in range(0, len(jpeg), PAYLOAD_SIZE)]
    packet_count = len(chunks)
    frame_length = len(jpeg)
    packets = []
    for idx, chunk in enumerate(chunks):
        header = HEADER.pack(
            MAGIC,
            VERSION,
            FLAGS,
            HEADER_SIZE,
            frame_id,
            idx,
            packet_count,
            frame_length,
        )
        packets.append(header + chunk)
    return packets


# ---------------------------------------------------------------------------
# Sender
# ---------------------------------------------------------------------------

def run(
    host: str,
    port: int,
    fps: float,
    image_path: str | None,
    shuffle: bool,
    drop_rate: float,
) -> None:
    import random

    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)

    interval = 1.0 / fps
    frame_id = 0

    # Load a fixed JPEG if supplied; otherwise generate per-frame
    static_jpeg: bytes | None = None
    if image_path:
        with open(image_path, "rb") as f:
            static_jpeg = f.read()
        if not (static_jpeg.startswith(b"\xff\xd8") and static_jpeg.endswith(b"\xff\xd9")):
            raise SystemExit(f"File does not look like a valid JPEG: {image_path}")
        print(f"[SIM] Loaded static JPEG: {len(static_jpeg)} bytes")

    print(f"[SIM] Broadcasting to {host}:{port} at {fps} fps")
    print(f"[SIM] Packet payload: {PAYLOAD_SIZE} bytes, header: {HEADER_SIZE} bytes")
    if shuffle:
        print("[SIM] Packet order: shuffled (tests out-of-order reassembly)")
    if drop_rate > 0:
        print(f"[SIM] Drop rate: {drop_rate*100:.0f}% (tests incomplete-frame discard)")
    print("[SIM] Press Ctrl+C to stop.\n")

    try:
        while True:
            t0 = time.monotonic()

            jpeg = static_jpeg if static_jpeg is not None else _synthetic_jpeg(frame_id)
            packets = _build_packets(frame_id, jpeg)

            if shuffle:
                random.shuffle(packets)

            sent = 0
            for pkt in packets:
                if drop_rate > 0 and random.random() < drop_rate:
                    continue
                sock.sendto(pkt, (host, port))
                sent += 1

            print(
                f"\r[SIM] frame {frame_id:6d}  "
                f"{len(jpeg):6d} B  "
                f"{len(packets)} pkts  "
                f"sent {sent}",
                end="",
                flush=True,
            )
            frame_id += 1

            elapsed = time.monotonic() - t0
            sleep_for = interval - elapsed
            if sleep_for > 0:
                time.sleep(sleep_for)

    except KeyboardInterrupt:
        print(f"\n[SIM] Stopped after {frame_id} frames.")
    finally:
        sock.close()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    p = argparse.ArgumentParser(description="ResQ Rover camera UDP simulator")
    p.add_argument("--host",       default=DEFAULT_HOST, help="Broadcast/unicast target IP")
    p.add_argument("--port",       type=int, default=DEFAULT_PORT, help="UDP port (default 4210)")
    p.add_argument("--fps",        type=float, default=DEFAULT_FPS, help="Frames per second (default 10)")
    p.add_argument("--image",      default=None, metavar="PATH", help="Static JPEG to loop (default: synthetic)")
    p.add_argument("--shuffle",    action="store_true", help="Shuffle packet order to test reassembler")
    p.add_argument("--drop-rate",  type=float, default=0.0, metavar="0.0-1.0",
                   help="Fraction of packets to drop (tests timeout/discard path)")
    args = p.parse_args()

    if not 0.0 <= args.drop_rate <= 1.0:
        p.error("--drop-rate must be between 0.0 and 1.0")

    run(
        host=args.host,
        port=args.port,
        fps=args.fps,
        image_path=args.image,
        shuffle=args.shuffle,
        drop_rate=args.drop_rate,
    )


if __name__ == "__main__":
    main()
