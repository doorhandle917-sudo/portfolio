// Fake boot: GRUB menu → kernel log → OpenRC services → auto-login greeter.
// Total runtime is ~6.3 s; Esc or the Skip button jumps straight to the end.
import { h, asset, formatTime } from '../os/util.js';
import { KERNEL } from '../os/release.js';

const SKIPPED = Symbol('skipped');

// Stage budgets in ms (sum + fade-out stays well under 8 s).
const T = { grub: 1000, loading: 300, kernel: 1500, openrc: 1900 };

export function createBoot({ content, wallpaper }) {
  const { system, person } = content;
  const controller = new AbortController();
  const { signal } = controller;
  let onEnter = null;

  const skipButton = h('button', { class: 'boot-skip', type: 'button', onClick: () => controller.abort() }, 'Skip', h('kbd', null, 'Esc'));
  const screen = h('div', { class: 'boot-screen' });
  const root = h('div', { class: 'boot', role: 'region', 'aria-label': 'Boot sequence', tabindex: '-1' },
    h('p', { class: 'sr-only', role: 'status' }, 'Booting Gentoo Linux. Press Escape or the Skip button to skip.'),
    screen,
    skipButton,
  );

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); controller.abort(); }
    else if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); }
  }

  function wait(ms) {
    return new Promise((resolve, reject) => {
      if (signal.aborted) return reject(SKIPPED);
      const timer = setTimeout(resolve, ms);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(SKIPPED); }, { once: true });
    });
  }

  function show(stage) {
    screen.replaceChildren(stage);
    return stage;
  }

  // --- GRUB ----------------------------------------------------------------
  async function grub() {
    const entries = ['Gentoo GNU/Linux', `Advanced options for Gentoo GNU/Linux`, 'UEFI Firmware Settings'];
    show(h('div', { class: 'boot-stage grub', 'aria-hidden': 'true' },
      h('p', { class: 'grub-title' }, 'GNU GRUB  version 2.12'),
      h('ul', { class: 'grub-menu' }, entries.map((label, i) =>
        h('li', { class: i === 0 ? 'is-selected' : null }, (i === 0 ? '*' : ' ') + label))),
      h('p', { class: 'grub-help' },
        "Use the ↑ and ↓ keys to select which entry is highlighted.\n" +
        "Press enter to boot the selected OS, `e' to edit the commands\n" +
        "before booting or `c' for a command-line.\n" +
        '   The highlighted entry will be executed automatically in 1s.'),
    ));
    // Enter boots the highlighted entry immediately, like the real thing.
    await Promise.race([wait(T.grub), new Promise((resolve) => { onEnter = resolve; })]);
    onEnter = null;
  }

  // --- kernel ----------------------------------------------------------------
  async function kernel() {
    const consoleEl = show(h('div', { class: 'boot-stage console', 'aria-hidden': 'true' }));
    const print = (text, ts) => {
      const line = h('p', { class: 'console-line' });
      if (ts != null) line.append(h('span', { class: 'ts' }, `[${ts.toFixed(6).padStart(12, ' ')}] `));
      line.append(text);
      consoleEl.append(line);
      while (consoleEl.childElementCount > 120) consoleEl.firstElementChild.remove();
    };

    print("  Booting `Gentoo GNU/Linux'");
    print('');
    print(`Loading Linux ${KERNEL} ...`);
    print('Loading initial ramdisk ...');
    await wait(T.loading);
    consoleEl.replaceChildren();

    const lines = kernelLog(system.hostname);
    const step = T.kernel / lines.length;
    for (const [ts, text] of lines) {
      print(text, ts);
      await wait(step);
    }
  }

  // --- OpenRC -----------------------------------------------------------------
  async function openrc() {
    const consoleEl = show(h('div', { class: 'boot-stage console', 'aria-hidden': 'true' }));
    consoleEl.append(
      h('p', { class: 'console-line rc-banner' }, '   ', h('i', null, 'OpenRC'), ' ', h('b', null, '0.62.6'), ' is starting up ', h('i', null, 'Gentoo Linux'), ' (x86_64)'),
      h('p', { class: 'console-line' }, ''),
    );
    const services = openrcLog(system.hostname);
    const step = T.openrc / services.length;
    for (const [msg, hasStatus] of services) {
      const status = h('span', { class: 'rc-status' });
      consoleEl.append(h('p', { class: 'console-line rc-line' },
        h('span', { class: 'rc-star' }, ' *'), h('span', { class: 'msg' }, msg + (hasStatus ? ' ...' : '')), status));
      await wait(step * 0.55);
      if (hasStatus) status.append('[ ', h('span', { class: 'ok' }, 'ok'), ' ]');
      await wait(step * 0.45);
    }
  }

  // --- greeter -----------------------------------------------------------------
  async function greeter() {
    const dots = h('span', { 'aria-hidden': 'true' });
    const label = h('span', { class: 'label' }, 'Password');
    const button = h('div', { class: 'greeter-button', 'aria-hidden': 'true' }, 'Log In');
    const message = h('p', { class: 'greeter-msg', role: 'status' });
    const clock = formatTime(new Date(), system.timezone, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const stage = show(h('div', { class: 'boot-stage greeter' },
      h('div', { class: 'greeter-bar', 'aria-hidden': 'true' }, h('span', null, system.hostname), h('span', null, clock)),
      h('div', { class: 'greeter-card' },
        h('img', { class: 'greeter-avatar', src: asset(person.avatar), alt: '', width: '96', height: '96', decoding: 'async' }),
        h('p', { class: 'greeter-name' }, person.name),
        h('p', { class: 'greeter-user' }, system.user + '@' + system.hostname),
        h('div', { class: 'greeter-field' }, label, dots),
        button,
        message,
      ),
    ));
    if (wallpaper) stage.style.setProperty('--greeter-wallpaper', wallpaper);

    await wait(300);
    label.remove();
    for (let i = 0; i < 8; i++) { dots.append('•'); await wait(45); }
    await wait(120);
    button.classList.add('is-pressed');
    message.textContent = 'Logging in…';
    await wait(300);
    message.textContent = `Welcome, ${person.name.split(' ')[0]}`;
    await wait(250);
  }

  return {
    element: root,
    skip: () => controller.abort(),
    /** Plays the sequence; resolves when finished or skipped. */
    async play() {
      document.body.append(root);
      root.focus({ preventScroll: true });
      document.addEventListener('keydown', onKey, true);
      try {
        await grub();
        await kernel();
        await openrc();
        await greeter();
      } catch (err) {
        if (err !== SKIPPED) throw err;
      } finally {
        document.removeEventListener('keydown', onKey, true);
      }
    },
    /** Fades the boot screen out (the desktop is already mounted underneath). */
    async exit({ instant = false } = {}) {
      if (!instant) {
        root.classList.add('is-leaving');
        await new Promise((r) => setTimeout(r, 400));
      }
      root.remove();
    },
  };
}

function kernelLog(hostname) {
  return [
    [0, `Linux version ${KERNEL} (portage@${hostname}) (x86_64-pc-linux-gnu-gcc (Gentoo 14.3.1 p4) 14.3.1, GNU ld (Gentoo 2.44 p4) 2.44.0) #1 SMP PREEMPT_DYNAMIC`],
    [0, `Command line: BOOT_IMAGE=/vmlinuz-${KERNEL} root=PARTUUID=5e7a1c2d-03 ro quiet`],
    [0, 'BIOS-provided physical RAM map:'],
    [0, 'BIOS-e820: [mem 0x0000000000000000-0x000000000009ffff] usable'],
    [0, 'NX (Execute Disable) protection: active'],
    [0, 'DMI: Web Browser Virtual Machine/Viewport, BIOS site-v2 10/04/2026'],
    [0.000012, 'tsc: Detected 3193.912 MHz processor'],
    [0.004201, 'e820: update [mem 0x00000000-0x00000fff] usable ==> reserved'],
    [0.031180, 'ACPI: Early table checksum verification disabled'],
    [0.052994, 'Memory: 16148204K/16677860K available (20480K kernel code)'],
    [0.061237, 'SLUB: HWalign=64, Order=0-3, MinObjects=0, CPUs=8, Nodes=1'],
    [0.071513, 'rcu: Preemptible hierarchical RCU implementation.'],
    [0.083002, 'Console: colour dummy device 80x25'],
    [0.083951, 'printk: legacy console [tty0] enabled'],
    [0.104118, 'ACPI: Core revision 20240827'],
    [0.151277, 'smp: Brought up 1 node, 8 CPUs'],
    [0.163020, 'devtmpfs: initialized'],
    [0.171584, 'NET: Registered PF_NETLINK/PF_ROUTE protocol family'],
    [0.214006, 'PCI: Using configuration type 1 for base access'],
    [0.262115, 'SCSI subsystem initialized'],
    [0.281937, 'usbcore: registered new interface driver usbfs'],
    [0.338120, 'clocksource: Switched to clocksource tsc'],
    [0.351624, 'NET: Registered PF_INET protocol family'],
    [0.402236, 'Freeing initrd memory: 11264K'],
    [0.431990, 'Key type asymmetric registered'],
    [0.452871, 'Block layer SCSI generic (bsg) driver version 0.4 loaded (major 247)'],
    [0.601457, 'nvme nvme0: 8/0/0 default/read/poll queues'],
    [0.604012, ' nvme0n1: p1 p2 p3'],
    [0.711683, 'usb 1-1: new high-speed USB device number 2 using xhci_hcd'],
    [0.902331, 'EXT4-fs (nvme0n1p3): mounted filesystem with ordered data mode. Quota mode: none.'],
    [0.918877, 'Freeing unused kernel image (initmem) memory: 3612K'],
    [0.919204, 'Write protecting the kernel read-only data: 26624k'],
    [0.921115, 'Run /sbin/init as init process'],
    [1.248630, 'random: crng init done'],
  ];
}

function openrcLog(hostname) {
  return [
    ['/proc is already mounted', false],
    ['Mounting /run', true],
    ['/run/openrc: creating directory', false],
    ['Caching service dependencies', true],
    ['Mounting devtmpfs on /dev', true],
    ['Starting udev', true],
    ['Waiting for uevents to be processed', true],
    ['Checking local filesystems ', true],
    ['Remounting root filesystem read/write', true],
    ['Mounting local filesystems', true],
    [`Setting hostname to ${hostname}`, true],
    ['Bringing up interface lo', true],
    ['Bringing up interface eth0', true],
    ['Starting sshd', true],
    ['Starting docker', true],
    ['Starting caddy', true],
    ['Starting display-manager', true],
  ];
}
