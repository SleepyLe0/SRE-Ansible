# INT531 SRE Final Capstone - Ansible Deployment

> **Complete automation for deploying a Next.js SSR application with comprehensive monitoring stack on Proxmox**

[![Ansible](https://img.shields.io/badge/Ansible-2.15+-red.svg)](https://www.ansible.com/)
[![Docker](https://img.shields.io/badge/Docker-24.0+-blue.svg)](https://www.docker.com/)
[![Prometheus](https://img.shields.io/badge/Prometheus-2.47+-orange.svg)](https://prometheus.io/)
[![Grafana](https://img.shields.io/badge/Grafana-10.2+-yellow.svg)](https://grafana.com/)

**Project**: The Resilient Infrastructure Challenge
**Team**: INT531 Node 2 Team
**Institution**: King Mongkut's University of Technology Thonburi (KMUTT)
**Year**: 2025

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Architecture Overview](#-architecture-overview)
- [Prerequisites](#-prerequisites)
- [Project Structure](#-project-structure)
- [Deployment Guide](#-deployment-guide)
- [What Gets Deployed](#-what-gets-deployed)
- [Configuration](#-configuration)
- [Testing & Verification](#-testing--verification)
- [Monitoring & Alerting](#-monitoring--alerting)
- [Quick Reference](#-quick-reference)
- [Metrics Details](#-metrics-details)
- [Troubleshooting](#-troubleshooting)
- [Support & Resources](#-support--resources)

---

## 🚀 Quick Start

**One-Command Deployment:**

```bash
cd SRE-Ansible
ansible-playbook -i inventory.ini playbook.yml
```

**Access URLs After Deployment:**

| Service | URL | Credentials |
|---------|-----|-------------|
| Next.js App | `http://10.13.104.81:3100` | - |
| Grafana | `http://10.13.104.81:3000` | admin/admin |
| Prometheus | `http://10.13.104.81:9090` | - |
| Database | `10.13.104.81:3306` | - |
| Node Exporter | `http://10.13.104.81:9100/metrics` | - |

> **Note**: Replace `10.13.104.81` with your actual VM IP address configured in `playbook.yml` (vm_target_ip)

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Proxmox Hypervisor                      │
│                      (10.13.104.212)                        │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │        Virtual Machine (Ubuntu 22.04 LTS)              │ │
│  │              (10.13.104.221)                           │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │         Application Tier (Docker Compose)      │ │ │
│  │  │                                                  │ │ │
│  │  │  Next.js App (SSR) ─────────► Port 3100       │ │ │
│  │  │  Database (MariaDB) ─────────► Port 3306       │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  │                                                        │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │         Monitoring Tier (Docker Compose)         │ │ │
│  │  │                                                  │ │ │
│  │  │  Prometheus ────────────────► Port 9090         │ │ │
│  │  │  Grafana ───────────────────► Port 3000         │ │ │
│  │  │  Node Exporter (systemd) ───► Port 9100         │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

Legend:
─── Network/Communication Flow
```

**Network Stack:**
- **VLAN 3104**: Data plane (application traffic)
- **VLAN 4095**: IMM management network
- **LACP Bonding**: Dual Ethernet switches for redundancy

---

## 📦 Prerequisites

### 1. Software Requirements

**On Your Workstation:**
- Ansible 2.15+ installed
- Git Bash or WSL (for Windows)
- SSH client
- Network connectivity to Proxmox server

**Install Ansible:**

```bash
# On Ubuntu/Debian
sudo apt update
sudo apt install ansible

# On macOS
brew install ansible

# On Windows (WSL)
sudo apt update && sudo apt install ansible
```

**Install Required Ansible Collections:**

```bash
ansible-galaxy collection install community.proxmox
ansible-galaxy collection install community.general
ansible-galaxy collection install community.crypto
```

**Verify Installation:**

```bash
ansible --version
ansible-galaxy collection list
```

### 2. Proxmox Template Setup

**Create Ubuntu Cloud Image Template on Proxmox:**

```bash
# SSH into Proxmox server
ssh root@10.13.104.212

# Download Ubuntu Cloud Image
wget https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img

# Create Virtual Machine
qm create 9000 --name "ubuntu-cloud-template-v1" --memory 2048 --cores 2 --net0 virtio,bridge=vmbr0

# Import disk image
qm importdisk 9000 noble-server-cloudimg-amd64.img local-lvm

# Attach the disk to VM
qm set 9000 --scsihw virtio-scsi-pci --scsi0 local-lvm:vm-9000-disk-0

# Set boot disk
qm set 9000 --boot c --bootdisk scsi0

# Resize disk (add 30GB)
qm resize 9000 scsi0 +30G

# Add cloud-init drive
qm set 9000 --ide2 local-lvm:cloudinit

# Enable serial console
qm set 9000 --serial0 socket --vga serial0

# Enable QEMU agent
qm set 9000 --agent enabled=1

# Convert to template
qm template 9000

# Exit Proxmox
exit
```

### 3. Network Access

Ensure network connectivity:

```bash
# Test Proxmox connectivity
ping 10.13.104.212

# Test SSH access
ssh root@10.13.104.212
```

---

## 📂 Project Structure

```
SRE-Ansible/
├── inventory.ini                     # Inventory configuration
├── playbook.yml                      # Main orchestration playbook
├── README.md                         # This comprehensive guide
├── privatekey                        # SSH private key (auto-generated)
├── privatekey.pub                   # SSH public key (auto-generated)
│
└── roles/
    ├── common/                       # System configuration role
    │   └── tasks/
    │       └── main.yml              # User setup, NTP, timezone, packages
    │
    ├── app/                          # Application deployment role
    │   └── tasks/
    │       └── main.yml              # Docker install & app deploy
    │                                 # Clones: https://github.com/SleepyLe0/int531-demo.git
    │
    └── monitor/                      # Monitoring stack role
        └── tasks/
            └── main.yml              # Prometheus, Grafana, Node Exporter
                                     # Clones: https://github.com/SleepyLe0/int531-sre-monitor.git
```

---

## 🛠️ Deployment Guide

### Step 1: Clone/Navigate to Project

```bash
cd "C:\Users\Admin\Desktop\KMUTT 4th\SRE\ansible-example"

# Or on Linux/Mac:
cd ~/ansible-example
```

### Step 2: Configure Variables

**Edit `playbook.yml`** (lines 3-12):

```yaml
vars:
  vm_name: godegapoke                     # Your VM name
  vm_template: ubuntu-cloud-template-v1   # Template name from prerequisites
  proxmox_node: int531-02                 # Your Proxmox node name
  proxmox_api_host: 10.13.104.212         # Proxmox IP address
  proxmox_api_user: root@pam              # Proxmox username
  proxmox_api_password: int53102          # Proxmox password
  proxmox_storage: local-lvm              # Storage pool
  vm_target_ip: 10.13.104.221             # Desired VM IP
  ssh_key_path: "{{ playbook_dir }}/privatekey"
```

**Edit `inventory.ini`**:

```ini
[web]
10.13.104.212                    # Proxmox host IP

[all:vars]
ansible_connection=ssh
ansible_user=root
ansible_ssh_pass=int53102        # Proxmox root password

[proxmox]
localhost ansible_connection=local

[vm]
10.13.104.221                    # Same as vm_target_ip above
```

### Step 3: Run Pre-Deployment Checks

```bash
# Check Ansible syntax
ansible-playbook playbook.yml --syntax-check

# Dry run (optional)
ansible-playbook playbook.yml --check
```

### Step 4: Execute Deployment

```bash
# Standard deployment
ansible-playbook playbook.yml

# With verbose output (recommended for first run)
ansible-playbook playbook.yml -v

# Maximum verbosity (for debugging)
ansible-playbook playbook.yml -vvv
```

**Expected Execution Time:** 8-12 minutes

**Expected Output:**

```
PLAY RECAP *********************************************************************
localhost                  : ok=13   changed=5    unreachable=0    failed=0
10.13.104.221              : ok=58   changed=45   unreachable=0    failed=0
```

### Step 5: Verify Deployment

**Check VM on Proxmox:**

```bash
ssh root@10.13.104.212
qm list
# Should show your VM running
exit
```

**Check Services on VM:**

```bash
# SSH into deployed VM
ssh -i privatekey root@10.13.104.221

# Check containers
docker ps

# Expected: 6 containers running
# frontend-app, backend-app, mariadb-db, prometheus, grafana, alertmanager

# Check Node Exporter
systemctl status node_exporter

# Exit VM
exit
```

**Access Web Interfaces:**

Open these URLs in your browser:

- Next.js App: `http://10.13.104.81:3100`
- Grafana: `http://10.13.104.81:3000` (admin/admin)
- Prometheus: `http://10.13.104.81:9090/targets` (all should be "UP")

---

## 🎯 What Gets Deployed

### Role 1: Common (System Configuration)

**Tasks:**
- ✅ Creates `sysadmin` user with sudo privileges
- ✅ Configures SSH key authentication
- ✅ Installs essential packages (vim, htop, curl, wget, chrony)
- ✅ Sets up NTP time synchronization
- ✅ Configures timezone (Asia/Bangkok)

**Files Modified:**
- `/etc/sudoers.d/sysadmin`
- `/home/sysadmin/.ssh/authorized_keys`
- `/etc/timezone`

### Role 2: App (Application Stack)

**Tasks:**
- ✅ Installs Docker CE and Docker Compose V2
- ✅ Installs Git
- ✅ Clones `https://github.com/SleepyLe0/int531-demo.git` to `/opt/app`
- ✅ Creates `.env` file from `.env.example` if needed
- ✅ Deploys Next.js SSR application (port 3100)
- ✅ Deploys Database (MariaDB on port 3306)
- ✅ Waits for application to be ready

**Containers Deployed:**
- `x-nextjs-app`: Next.js Server-Side Rendered application
- `x-mariadb`: Database with persistent volumes and Drizzle migrations

**Application Features:**
- 📝 Full CRUD operations for student management
- 📊 Prometheus metrics export at `/api/metrics`
- 🎨 Modern Next.js UI with SSR
- 🗄️ Drizzle ORM for database management
- 🔄 Automatic database migrations on startup

### Role 3: Monitor (Observability Stack)

**Tasks:**
- ✅ Installs Node Exporter as systemd service
- ✅ Clones `https://github.com/SleepyLe0/int531-sre-monitor.git` to `/opt/monitoring`
- ✅ Updates docker-compose.yml to connect to app network
- ✅ Deploys Prometheus with Docker Compose (port 9090)
- ✅ Deploys Grafana with Docker Compose (port 3000)
- ✅ Configures Prometheus to scrape app metrics
- ✅ Verifies all services are healthy

**Services Deployed:**
- **Prometheus**: Metrics collection from Next.js app and Node Exporter
- **Grafana**: Pre-configured dashboards for monitoring
- **Node Exporter**: System-level metrics (CPU, memory, disk, network)

**Monitoring Configuration:**
- Prometheus scrapes: `prometheus:9090`, `host.docker.internal:9100` (Node Exporter), `x-nextjs-app:3100/api/metrics` (App metrics)
- Grafana dashboards available in `/opt/monitoring/grafana/dashboards/`
- Network connectivity between monitoring stack and application via Docker networks

---

## ⚙️ Configuration

### Modify Application Code

The application code is cloned from GitHub. To modify:

1. Fork/clone `https://github.com/SleepyLe0/int531-demo.git`
2. Make your changes
3. Push to your repository
4. Update `roles/app/tasks/main.yml` to point to your repository
5. Redeploy:

```bash
ansible-playbook playbook.yml --tags app
```

### Modify Monitoring Configuration

The monitoring configuration is cloned from GitHub. To modify:

1. Fork/clone `https://github.com/SleepyLe0/int531-sre-monitor.git`
2. Edit Prometheus config in `prometheus/prometheus.yml`
3. Edit Grafana dashboards in `grafana/dashboards/`
4. Push to your repository
5. Update `roles/monitor/tasks/main.yml` to point to your repository
6. Redeploy:

```bash
ansible-playbook playbook.yml --tags monitor
```

---

## 🧪 Testing & Verification

### 1. Test Normal Operations

```bash
# SSH into VM
ssh -i privatekey root@10.13.104.221

# Check all containers
docker ps

# Check logs
docker logs frontend-app
docker logs backend-app
docker logs mariadb-db
```

### 2. Test Application

1. Open Next.js app: `http://10.13.104.81:3100`
2. Test CRUD operations (Add, Update, Delete students)
3. Verify database persistence
4. Check application metrics at `http://10.13.104.81:3100/api/metrics`

### 3. Test Monitoring

1. Open Grafana: `http://10.13.104.81:3000`
2. Login with `admin` / `admin`
3. Navigate to Dashboards section
4. Import dashboards from `/opt/monitoring/grafana/dashboards/` if needed
5. Observe real-time metrics updating

### 4. Verify Prometheus Scraping

**Check Prometheus Targets:**

```bash
# View targets status
curl http://10.13.104.81:9090/api/v1/targets

# Or visit: http://10.13.104.81:9090/targets
# All targets should show "UP" status
```

**Check App Metrics:**

```bash
# Verify app metrics endpoint
curl http://10.13.104.81:3100/api/metrics

# Should return Prometheus-formatted metrics
```

### 5. Chaos Testing Scenarios

**Scenario 1: Application Service Kill**

```bash
ssh -i privatekey root@10.13.104.81
docker kill x-nextjs-app

# Watch for restart policy
docker ps -a | grep x-nextjs-app

# Check Prometheus targets
curl http://10.13.104.81:9090/api/v1/targets
```

**Scenario 2: High CPU Simulation**

```bash
ssh -i privatekey root@10.13.104.81
apt install stress -y
stress --cpu 4 --timeout 600

# Monitor in Grafana dashboard
```

**Scenario 3: High Memory Simulation**

```bash
stress --vm 2 --vm-bytes 1G --timeout 600

# Watch metrics in Grafana
```

**Scenario 4: Load Testing**

```bash
# Install Apache Bench
apt install apache2-utils -y

# Run load test
ab -n 10000 -c 100 http://10.13.104.81:3100/api/students

# Monitor in real-time
watch -n 1 'docker stats --no-stream'
```

---

## 📊 Monitoring & Alerting

### Four Golden Signals Dashboard

**1. Latency (Response Time)**
- Metrics: P50, P95, P99 response times
- Query: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
- Threshold: Warning >500ms, Critical >1000ms

**2. Traffic (Requests per Second)**
- Metrics: HTTP requests/sec by service
- Query: `rate(http_requests_total[1m])`
- Helps identify traffic patterns

**3. Errors (HTTP 5xx Error Rate)**
- Metrics: Percentage of 5xx errors
- Query: `(rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])) * 100`
- Threshold: Critical >1%

**4. Saturation (CPU/Memory)**
- CPU: `100 - (avg(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)`
- Memory: `(1 - (node_memory_AvailableBytes / node_memory_TotalBytes)) * 100`
- Threshold: Warning >70%, Critical >85%

### SLO Tracking

**Defined SLO:** 99.9% Availability

**Formula:**
```
Availability = (Successful Requests / Total Requests) × 100
```

**Prometheus Query:**
```promql
(sum(rate(http_requests_total{status!~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) * 100
```

### Metrics Collection Flow

```
Next.js App → /api/metrics → Prometheus → Grafana Dashboards
Node Exporter → Port 9100 → Prometheus → Grafana Dashboards
```

**Key Metrics:**
- 🔴 **Application Metrics**: HTTP requests, latency, errors from Next.js app
- ⚠️ **System Metrics**: CPU, memory, disk, network from Node Exporter
- ℹ️ **Database Metrics**: Query performance, connections (if exposed)

---

## 📚 Quick Reference

### Access URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Next.js App | `http://10.13.104.81:3100` | Student Management UI (SSR) |
| App Metrics | `http://10.13.104.81:3100/api/metrics` | Prometheus metrics endpoint |
| Prometheus | `http://10.13.104.81:9090` | Metrics collection & query |
| Prometheus Targets | `http://10.13.104.81:9090/targets` | Scrape targets status |
| Grafana | `http://10.13.104.81:3000` | Dashboards (admin/admin) |
| Node Exporter | `http://10.13.104.81:9100/metrics` | System metrics |
| Database | `10.13.104.81:3306` | MariaDB (internal use) |

### SSH Access

```bash
# Access VM (use IP from playbook.yml vm_target_ip)
ssh -i privatekey root@10.13.104.81

# Access Proxmox (use IP from playbook.yml proxmox_api_host)
ssh root@10.13.104.215
```

### Docker Commands

```bash
# List containers
docker ps

# View logs
docker logs -f x-nextjs-app
docker logs -f x-mariadb

# Restart container
docker restart x-nextjs-app

# Restart all application containers
cd /opt/app
docker compose restart

# Stop all containers
docker compose down

# Start all containers
docker compose up -d --build

# Check resource usage
docker stats --no-stream

# Restart monitoring stack
cd /opt/monitoring
docker compose restart
```

### Database Access

```bash
# Connect to MariaDB (check .env for credentials)
docker exec -it x-mariadb mysql -u appuser -papppassword students_db

# Or use environment variables from .env
docker exec -it x-mariadb mysql -u ${MYSQL_USER} -p${MYSQL_PASSWORD} ${MYSQL_DATABASE}

# Run queries
SELECT * FROM students;
SELECT COUNT(*) FROM students;

# Exit
exit
```

### Service Management

```bash
# Check Node Exporter
systemctl status node_exporter
systemctl restart node_exporter
journalctl -u node_exporter -f

# Check Docker service
systemctl status docker
systemctl restart docker
```

### Health Checks

```bash
# Application health (replace IP with your VM IP)
curl http://10.13.104.81:3100/health     # Next.js app
curl http://10.13.104.81:3100/api/metrics  # Metrics endpoint

# Monitoring health
curl http://10.13.104.81:9090/-/healthy # Prometheus
curl http://10.13.104.81:9100/metrics   # Node Exporter
```

### Useful Prometheus Queries

```promql
# HTTP Request Rate
rate(http_requests_total[5m])

# Error Rate Percentage
(rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])) * 100

# P95 Latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# CPU Usage
100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory Usage
(1 - (node_memory_AvailableBytes / node_memory_TotalBytes)) * 100

# Disk Usage
100 - ((node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"}) * 100)

# Database Query Rate
rate(db_queries_total[5m])

# Active Requests
active_requests
```

### Re-Deploy After Changes

```bash
# Re-deploy entire stack
ansible-playbook playbook.yml

# Re-deploy application only
ansible-playbook playbook.yml --tags app

# Re-deploy monitoring only
ansible-playbook playbook.yml --tags monitor

# Re-deploy common configuration
ansible-playbook playbook.yml --tags common
```

---

## 🔍 Metrics Details

### Next.js App Exports Metrics

The Next.js application exports Prometheus metrics at `/api/metrics` endpoint, including:

#### 1. HTTP Metrics

```prometheus
# Request counter
http_requests_total{method, route, status}

# Request duration histogram
http_request_duration_seconds{method, route, status}

# Error counter
http_requests_errors_total{method, route, status}
```

#### 2. Node.js Default Metrics

```prometheus
# CPU
process_cpu_user_seconds_total
process_cpu_system_seconds_total

# Memory
process_resident_memory_bytes
nodejs_heap_size_total_bytes
nodejs_heap_size_used_bytes

# Event Loop
nodejs_eventloop_lag_seconds

# Garbage Collection
nodejs_gc_duration_seconds
```

### Metrics Endpoints

**Next.js app provides:**
- `/api/metrics` - Prometheus metrics endpoint (scraped by Prometheus)

**Example Metrics Output:**

```prometheus
# HELP http_requests_total Total HTTP requests
# TYPE http_requests_total counter
http_requests_total{method="GET",route="/api/students",status="200"} 125

# HELP http_request_duration_seconds HTTP request latency
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/api/students",status="200",le="0.1"} 120
http_request_duration_seconds_bucket{method="GET",route="/api/students",status="200",le="0.5"} 125
http_request_duration_seconds_sum{method="GET",route="/api/students",status="200"} 8.5
http_request_duration_seconds_count{method="GET",route="/api/students",status="200"} 125

# HELP db_queries_total Total database queries
# TYPE db_queries_total counter
db_queries_total{operation="select",table="students"} 85
db_queries_total{operation="insert",table="students"} 20
db_queries_total{operation="update",table="students"} 15
db_queries_total{operation="delete",table="students"} 5

# HELP active_requests Currently active HTTP requests
# TYPE active_requests gauge
active_requests 3

# HELP db_active_connections Active database connections
# TYPE db_active_connections gauge
db_active_connections 2
```

---

## 🔧 Troubleshooting

### Issue 1: Ansible Collection Not Found

**Error:**
```
ERROR! couldn't resolve module/action 'community.proxmox.proxmox_kvm'
```

**Solution:**
```bash
ansible-galaxy collection install community.proxmox
ansible-galaxy collection install community.general
ansible-galaxy collection install community.crypto

# Verify
ansible-galaxy collection list
```

### Issue 2: Proxmox API Connection Failed

**Error:**
```
FAILED! => {"msg": "Failed to connect to Proxmox API"}
```

**Solution:**
```bash
# Check network
ping 10.13.104.212

# Verify credentials in playbook.yml
# Test Proxmox web UI: https://10.13.104.212:8006
```

### Issue 3: VM Creation Fails - Template Not Found

**Error:**
```
FAILED! => {"msg": "VM template 'ubuntu-cloud-template-v1' does not exist"}
```

**Solution:**
```bash
# SSH to Proxmox and list templates
ssh root@10.13.104.212
qm list

# Update playbook.yml with correct template name
```

### Issue 4: Containers Not Starting

**Symptoms:**
- `docker ps` shows containers in "Restarting" state
- Next.js app not accessible

**Solution:**
```bash
ssh -i privatekey root@10.13.104.81

# Check logs
docker logs x-nextjs-app
docker logs x-mariadb

# Common fixes:
# 1. Database not ready
docker logs x-mariadb
# Wait for database to be healthy

# 2. Port already in use
netstat -tlnp | grep -E '3100|3306'

# 3. Check .env file exists
ls -la /opt/app/.env

# 4. Restart all services
cd /opt/app
docker compose down
docker compose up -d --build
```

### Issue 5: Prometheus Not Scraping

**Symptoms:**
- Targets show "DOWN" in Prometheus UI
- No metrics in Grafana

**Solution:**
```bash
# Check Prometheus targets
curl http://10.13.104.81:9090/api/v1/targets

# Check app metrics endpoint
curl http://10.13.104.81:3100/api/metrics

# Check Prometheus config
docker exec prometheus cat /etc/prometheus/prometheus.yml

# Check network connectivity
docker network inspect app_sre-network

# Reload Prometheus
docker exec prometheus kill -HUP 1

# Or restart
cd /opt/monitoring
docker compose restart prometheus
```

### Issue 6: Grafana Dashboard Not Loading

**Symptoms:**
- Dashboard shows "No data"
- Datasource connection fails

**Solution:**
```bash
# Check Grafana logs
docker logs grafana

# Verify datasource
curl -u admin:admin http://10.13.104.81:3000/api/datasources

# Restart Grafana
cd /opt/monitoring
docker compose restart grafana

# Import dashboards manually:
# 1. Login to Grafana
# 2. Navigate to Dashboards → Import
# 3. Upload JSON files from /opt/monitoring/grafana/dashboards/
```

### Issue 7: Prometheus Not Scraping App Metrics

**Symptoms:**
- App metrics not appearing in Prometheus
- Targets show connection errors

**Solution:**
```bash
# Check if app is exposing metrics
curl http://10.13.104.81:3100/api/metrics

# Check Prometheus targets
curl http://10.13.104.81:9090/api/v1/targets

# Verify network connectivity
docker network inspect app_sre-network | grep -A 5 prometheus
docker network inspect app_sre-network | grep -A 5 x-nextjs-app

# Check Prometheus config
docker exec prometheus cat /etc/prometheus/prometheus.yml

# Restart Prometheus
cd /opt/monitoring
docker compose restart prometheus
```

### Issue 8: High Memory Usage / OOM

**Symptoms:**
- Containers being killed randomly
- System becomes unresponsive

**Solution:**
```bash
# Check memory usage
free -h
docker stats --no-stream

# Check for OOM killer
dmesg | grep -i "out of memory"

# Increase VM memory in Proxmox
# Or reduce container memory limits in docker-compose.yml
```

### Issue 9: SSH Connection Timeout During Deployment

**Error:**
```
TASK [Wait for VM to be reachable via SSH] *************************************
fatal: [localhost]: FAILED! => {"msg": "Timeout"}
```

**Solution:**
```bash
# Increase timeout in playbook.yml line 113:
timeout: 600  # From 450 to 600 seconds

# Check VM console in Proxmox web UI
# Verify cloud-init completed successfully
```

### Issue 10: Disk Space Full

**Symptoms:**
- Docker cannot pull images
- Containers fail to start
- Application errors

**Solution:**
```bash
ssh -i privatekey root@10.13.104.81

# Check disk usage
df -h

# Clean Docker
docker system prune -a -f
docker volume prune -f

# Check logs size
du -sh /var/log/
du -sh /var/lib/docker/

# Clean application data if needed
cd /opt/app
docker compose down -v
```

---

## 🆘 Support & Resources

### File Locations

```
Application:
  /opt/app/                           - Application root (cloned from GitHub)
  /opt/app/docker-compose.yml         - Compose file
  /opt/app/.env                       - Environment variables
  /opt/app/src/                       - Next.js source code
  /opt/app/drizzle/                   - Database migrations

Monitoring:
  /opt/monitoring/                    - Monitoring root (cloned from GitHub)
  /opt/monitoring/docker-compose.yml - Compose file
  /opt/monitoring/prometheus/         - Prometheus config
  /opt/monitoring/grafana/            - Grafana dashboards
  /usr/local/bin/node_exporter        - Node Exporter binary
  /etc/systemd/system/node_exporter.service - Service definition

Logs:
  docker logs [container-name]        - Container logs
  /var/log/syslog                     - System logs
  journalctl -u node_exporter          - Node Exporter logs
```

### Port Reference

| Service | Port | Protocol | Description |
|---------|------|----------|-------------|
| Next.js App | 3100 | HTTP | Web UI (SSR) |
| Database | 3306 | TCP | MariaDB |
| Prometheus | 9090 | HTTP | Metrics Collection |
| Grafana | 3000 | HTTP | Dashboards |
| Node Exporter | 9100 | HTTP | System Metrics |

### Documentation Links

- [Ansible Documentation](https://docs.ansible.com/)
- [Docker Documentation](https://docs.docker.com/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Google SRE Book - Four Golden Signals](https://sre.google/sre-book/monitoring-distributed-systems/)
- [Proxmox VE Documentation](https://pve.proxmox.com/pve-docs/)

### Emergency Procedures

**If issues occur during chaos testing:**

1. ✅ Check Prometheus targets: `http://10.13.104.81:9090/targets`
2. ✅ Check Grafana dashboard for metrics trend
3. ✅ SSH into VM and check container status: `docker ps -a`
4. ✅ Review logs for root cause: `docker logs [container-name]`
5. ✅ Implement mitigation from SRE Runbook in project report
6. ✅ Document incident in post-mortem

**Quick Recovery Commands:**

```bash
# Restart all application services
cd /opt/app && docker compose restart

# Restart monitoring stack
cd /opt/monitoring && docker compose restart

# Complete system restart
reboot
```

### Cleanup & Reset

**Remove VM and start fresh:**

```bash
# The playbook automatically removes existing VM before creating new one
ansible-playbook playbook.yml
```

**Manual VM removal:**

```bash
ssh root@10.13.104.212
qm stop <VM_ID>
qm destroy <VM_ID>
```

**Remove all containers and data on VM:**

```bash
ssh -i privatekey root@10.13.104.81
cd /opt/app
docker compose down -v
cd /opt/monitoring
docker compose down -v
systemctl stop node_exporter
systemctl disable node_exporter
```

---

## ✅ Deployment Checklist

**Before Deployment:**

- [ ] Ansible installed and collections added
- [ ] Proxmox template created (`ubuntu-cloud-template-v1`)
- [ ] Updated `playbook.yml` variables (VM name, IPs, credentials)
- [ ] Updated `inventory.ini` IPs
- [ ] Network connectivity verified to Proxmox
- [ ] (Optional) Discord webhook configured

**After Deployment:**

- [ ] All tasks completed successfully (0 failed)
- [ ] All containers running: `docker ps` shows 3+ containers (app, mariadb, prometheus, grafana)
- [ ] Next.js app accessible at port 3100
- [ ] Prometheus scraping all targets (check /targets)
- [ ] Grafana dashboard loads with data
- [ ] Node Exporter exporting metrics
- [ ] Can add/update/delete students in app
- [ ] App metrics endpoint accessible at `/api/metrics`
- [ ] Database migrations completed successfully

---

## 🎉 Success Indicators

**Your deployment is successful when:**

✅ Playbook completes with **0 failed tasks**
✅ All **containers** are running (app, mariadb, prometheus, grafana)
✅ All **Prometheus targets** show "UP" status
✅ **Grafana dashboard** displays metrics
✅ **Next.js app** loads and CRUD operations work
✅ **Metrics endpoint** returns Prometheus format at `/api/metrics`
✅ **Database migrations** completed successfully
✅ **No errors** in container logs

---

## 📝 Final Notes

### What Makes This Special

🌟 **Production-Ready**: Real Next.js SSR application with proper error handling
🌟 **Complete Metrics**: Application and system-level metrics
🌟 **SRE Best Practices**: Four Golden Signals monitoring, comprehensive observability
🌟 **Beautiful UI**: Modern Next.js UI with server-side rendering
🌟 **Repository-Based**: Uses GitHub repositories for easy updates and versioning
🌟 **Fully Automated**: Zero manual intervention after playbook execution
🌟 **Database Migrations**: Automatic Drizzle migrations on startup

### Intended Workflow

1. ✅ Create Proxmox VM template (prerequisites section)
2. ✅ Update `playbook.yml` and `inventory.ini` variables
3. ✅ Run `ansible-playbook playbook.yml`
4. ✅ Wait for Ansible to finish (~10 minutes)
5. ✅ Verify all services via web browser
6. ✅ Test application CRUD operations
7. ✅ Trigger chaos tests
8. ✅ Monitor SLO compliance
9. ✅ Document results for project report

### Known Limitations

⚠️ **Storage**: Uses Docker volumes instead of Dell EMC SAN (due to compatibility issues)
⚠️ **Container Restart**: Docker restart policies may not trigger as expected; use orchestration (Kubernetes/Swarm) for production
⚠️ **Single VM**: No horizontal scaling; consider load balancing for production
⚠️ **No Alertmanager**: Current setup focuses on metrics collection; add Alertmanager for production alerting

---

**You're all set!** This automation provides everything needed for the INT531 SRE Final Capstone Project. 🎉

Good luck with your chaos testing and demo! 💪

---

**Created for**: INT531 Site Reliability Engineering Final Capstone Project
**Version**: 1.0
**Last Updated**: December 20, 2025
**Contact**: Feel free to reach out to Electric Nutbuster on Discord for issues
