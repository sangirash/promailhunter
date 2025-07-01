You **cannot install and run pfSense natively on Ubuntu via terminal only** because pfSense is a FreeBSD-based standalone firewall/router OS, not a software package for Linux. However, you *can* install, configure, and run pfSense on Ubuntu **using terminal-based virtualization tools** like KVM (Kernel-based Virtual Machine) and `virt-install`. This means you run pfSense inside a virtual machine managed entirely from the Ubuntu terminal.

### How to install and run pfSense on Ubuntu using terminal only (via KVM)

1. **Install KVM and virtualization tools:**
   ```bash
   sudo apt update
   sudo apt install qemu-kvm libvirt-daemon-system libvirt-clients bridge-utils virtinst virt-manager
   ```
   (You can skip `virt-manager` if you want purely CLI.)

2. **Download the pfSense ISO:**
   ```bash
   mkdir -p ~/pfSense
   cd ~/pfSense
   wget https://nyifiles.pfsense.org/mirror/downloads/pfSense-CE-*-amd64.iso.gz
   gunzip pfSense-CE-*-amd64.iso.gz
   ```
   (Replace `*` with the latest version number.)

3. **Create storage for the VM:**
   ```bash
   qemu-img create -f qcow2 ~/pfSense/pfSense.img 16G
   ```

4. **Create and start the VM with `virt-install`:**
   ```bash
   sudo virt-install \
     --name pfSense \
     --ram 2048 \
     --vcpus 2 \
     --os-type=bsd \
     --os-variant=freebsd13.0 \
     --cdrom=~/pfSense/pfSense-CE-*-amd64.iso \
     --disk path=~/pfSense/pfSense.img,size=16 \
     --network network=default,model=e1000 \
     --graphics none \
     --console pty,target_type=serial \
     --boot cdrom,hd
   ```
   This runs the pfSense installer in text mode via the terminal.

5. **Follow the pfSense installer prompts in the terminal console** to install pfSense on the virtual disk.

6. **After installation, reboot the VM and pfSense will boot from the virtual disk.**

7. **Access pfSense console via terminal** (you will get a text-based interface to assign interfaces, configure IPs).

8. **Access pfSense Web GUI** from your host or network by navigating to the LAN IP address assigned during setup (usually `192.168.1.1`).

### Summary

- You **cannot install pfSense directly on Ubuntu** as a Linux application.
- You can **run pfSense as a VM on Ubuntu using terminal tools like KVM and virt-install**.
- The entire process can be done via terminal without GUI.
- After installation, pfSense is configured via its own console or Web GUI.

This approach is ideal for headless servers or automated deployments where no graphical interface is available[1][2][3].

Sources
[1] how to install pfSense from terminal? - GitHub Gist https://gist.github.com/mahammad/12624500899a54f721a9
[2] Install pfSense via KVM in Ubuntu 18.04 w/ netplan - Super User https://superuser.com/questions/1380054/install-pfsense-via-kvm-in-ubuntu-18-04-w-netplan
[3] Installing and Configuring pfSense - Servercore https://servercore.com/blog/articles/installing-and-configuring-pfsense/
[4] How to Install and Configure pfSense Firewall Router on Linux https://tothost.vn/en/tutorials/how-to-install-and-configure-pfsense-firewall-router-on-linux
[5] Installation Walkthrough | pfSense Documentation https://docs.netgate.com/pfsense/en/latest/install/install-walkthrough.html
[6] How To Install pfSense + Beginners Configuration Guide - YouTube https://www.youtube.com/watch?v=wUD1ZjPb4kw
[7] How to Install pfSense - Start to Finish! - YouTube https://www.youtube.com/watch?v=CmEYf1W3EqQ
[8] Getting Started With pfSense Software https://www.pfsense.org/getting-started/
[9] No Internet Access on Ubuntu Desktop with pfSense Setup - Reddit https://www.reddit.com/r/PFSENSE/comments/1h2jbxl/no_internet_access_on_ubuntu_desktop_with_pfsense/
[10] how to configure pfSense OpenVPN client on Ubuntu. - Reddit https://www.reddit.com/r/PFSENSE/comments/1j4cocr/how_to_configure_pfsense_openvpn_client_on_ubuntu/
