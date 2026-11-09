/**
 * In-Kernel Watchdog Python generator
 * Guarantees that an idle or abandoned Colab GPU session self-terminates
 * via `google.colab.runtime.unassign()` even if local client disconnects.
 */

export interface WatchdogOptions {
  ttlMinutes?: number;
  heartbeatPath?: string;
  checkIntervalSeconds?: number;
}

export function generateWatchdogScript(options: WatchdogOptions = {}): string {
  const ttlSec = (options.ttlMinutes ?? 20) * 60;
  const heartbeatPath = options.heartbeatPath ?? '/tmp/comfy_heartbeat';
  const interval = options.checkIntervalSeconds ?? 30;

  return `
import os
import sys
import time

HEARTBEAT_FILE = "${heartbeatPath}"
TTL_SECONDS = ${ttlSec}
INTERVAL = ${interval}

# Touch heartbeat initially
with open(HEARTBEAT_FILE, "w") as f:
    f.write(str(time.time()))

print(f"[WATCHDOG] In-kernel idle watchdog armed. TTL={TTL_SECONDS}s, Interval={INTERVAL}s")

while True:
    time.sleep(INTERVAL)
    try:
        if os.path.exists(HEARTBEAT_FILE):
            last_touch = os.path.getmtime(HEARTBEAT_FILE)
            idle_seconds = time.time() - last_touch
            if idle_seconds > TTL_SECONDS:
                print(f"[WATCHDOG] Idle limit exceeded ({idle_seconds:.1f}s > {TTL_SECONDS}s). Unassigning Colab VM...")
                from google.colab import runtime
                runtime.unassign()
                sys.exit(0)
    except Exception as e:
        print(f"[WATCHDOG] Warning: watchdog poll check encountered: {e}")
`.trim();
}
