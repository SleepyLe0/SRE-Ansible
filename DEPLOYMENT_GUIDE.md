# INT531 SRE Capstone - Ansible Deployment Guide

Complete automation for deploying a 3-tier application with comprehensive monitoring stack.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Proxmox Hypervisor                      │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Virtual Machine (Ubuntu)                  │ │
│  │                                                        │ │
│  │  Application Tier:                                     │ │
│  │  ├── Frontend (Node.js) - Port 3000                   │ │
│  │  ├── Backend (Node.js API) - Port 3001                │ │
│  │  └── Database (MariaDB) - Port 3306                   │ │
│  │                                                        │ │
│  │  Monitoring Tier:                                      │ │
│  │  ├── Prometheus - Port 9090                           │ │
│  │  ├── Grafana - Port 3001                              │ │
│  │  ├── Alertmanager - Port 9093                         │ │
│  │  └── Node Exporter - Port 9100                        │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## What This Automation Deploys

### 1. **Common Role** (`roles/common`)
- Creates `sysadmin` user with sudo privileges
- Installs essential packages (vim, htop, net-tools, chrony, etc.)
- Configures NTP time synchronization
- Sets timezone to Asia/Bangkok

### 2. **Application Role** (`roles/app`)
- Installs Docker and Docker Compose
- Deploys 3-tier application:
  - **Frontend**: Node.js web interface for student management
  - **Backend**: RESTful API with Prometheus metrics export
  - **Database**: MariaDB with persistent storage
- Configures Docker networking
- Waits for all services to be healthy

### 3. **Monitoring Role** (`roles/monitor`)
- **Node Exporter**: System metrics (CPU, Memory, Disk, Network)
- **Prometheus**: Metrics collection and alert evaluation
- **Alertmanager**: Alert routing and notification management
- **Grafana**: Visualization with pre-configured dashboard
- Alert rules for SRE best practices (Four Golden Signals)

## Prerequisites

1. **Proxmox VM Template** created with cloud-init support
2. **Ansible installed** on your workstation
3. **Network connectivity** to Proxmox host
4. **Required Ansible collections**:
   ```bash
   ansible-galaxy collection install community.general
   ansible-galaxy collection install community.crypto
   ansible-galaxy collection install community.proxmox
   ```

## Project Structure

```
ansible-example/
├── inventory.ini                 # Inventory file
├── playbook.yml                  # Main playbook
├── README.md                     # Original README
├── DEPLOYMENT_GUIDE.md          # This file
├── privatekey                    # SSH private key (auto-generated)
├── privatekey.pub               # SSH public key (auto-generated)
└── roles/
    ├── common/                   # Base system configuration
    │   └── tasks/
    │       └── main.yml
    ├── app/                      # Application deployment
    │   ├── tasks/
    │   │   └── main.yml
    │   ├── templates/
    │   │   └── docker-compose.yml.j2
    │   └── files/
    │       ├── frontend/         # Frontend app code
    │       │   ├── package.json
    │       │   ├── server.js
    │       │   └── public/
    │       │       └── index.html
    │       └── backend/          # Backend API code
    │           ├── package.json
    │           └── server.js
    └── monitor/                  # Monitoring stack
        ├── tasks/
        │   └── main.yml
        ├── templates/
        │   ├── prometheus.yml.j2
        │   ├── alert.rules.yml.j2
        │   └── alertmanager.yml.j2
        └── files/
            └── grafana-dashboard.json
```

## Step-by-Step Deployment

### Step 1: Update Configuration Variables

Edit `playbook.yml` and update these variables:

```yaml
vars:
  vm_name: int531-demo-app           # Your VM name
  vm_template: ubuntu-cloud-template-v1   # Your template name
  proxmox_node: int531-02            # Your Proxmox node name
  proxmox_api_host: 10.13.104.212    # Your Proxmox IP
  proxmox_api_user: root@pam         # Proxmox user
  proxmox_api_password: int53102     # Proxmox password
  vm_target_ip: 10.13.104.221        # Desired VM IP
  ssh_key_path: "{{ playbook_dir }}/privatekey"
```

### Step 2: Update Inventory File

Edit `inventory.ini`:

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

### Step 3: Run the Deployment

```bash
# Navigate to ansible directory
cd ansible-example

# Run the main playbook
ansible-playbook -i inventory.ini playbook.yml
```

This will:
1. Generate SSH keys if they don't exist
2. Create a new VM from template on Proxmox
3. Configure the VM with cloud-init
4. Install common packages and configure system
5. Deploy Docker and the application stack
6. Deploy the complete monitoring stack
7. Verify all services are running

### Step 4: Verify Deployment

After successful deployment, access these URLs:

```
Frontend Application:
  http://10.13.104.221:3000

Backend API:
  http://10.13.104.221:3001

Prometheus:
  http://10.13.104.221:9090

Grafana:
  http://10.13.104.221:3001
  Username: admin
  Password: admin

Alertmanager:
  http://10.13.104.221:9093

Node Exporter:
  http://10.13.104.221:9100/metrics
```

## Application Features

### Frontend (Student Management System)
- Modern web interface for CRUD operations
- Real-time backend status monitoring
- Response time tracking
- Test buttons for alerting simulation:
  - **Test Error Alert**: Triggers 5xx error endpoint
  - **Test Latency Alert**: Triggers slow response endpoint

### Backend API Endpoints

```
GET    /                      - API information
GET    /health               - Health check
GET    /metrics              - Prometheus metrics
GET    /api/students         - List all students
GET    /api/students/:id     - Get student by ID
POST   /api/students         - Create new student
PUT    /api/students/:id     - Update student
DELETE /api/students/:id     - Delete student
GET    /api/simulate-error   - Trigger error for testing
GET    /api/simulate-slow    - Trigger slow response for testing
```

### Database Schema

```sql
CREATE TABLE students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    major VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Monitoring & Alerting

### Configured Alerts

1. **HighErrorRate** (Critical)
   - Triggers when: HTTP 5xx error rate > 1%
   - Duration: 2 minutes
   - Action: Immediate notification

2. **HighLatency** (Warning)
   - Triggers when: P95 latency > 1 second
   - Duration: 5 minutes

3. **HighCPUUsage** (Warning)
   - Triggers when: CPU usage > 85%
   - Duration: 10 minutes

4. **HighMemoryUsage** (Warning)
   - Triggers when: Memory usage > 85%
   - Duration: 5 minutes

5. **ServiceDown** (Critical)
   - Triggers when: Any service is unreachable
   - Duration: 1 minute
   - Action: Immediate notification

6. **DiskSpaceLow** (Critical)
   - Triggers when: Disk space < 10%
   - Duration: 5 minutes

7. **SLOBurnRateHigh** (Critical)
   - Triggers when: Error budget burning too fast
   - Based on 99.9% availability SLO

### Grafana Dashboard

Pre-configured with **Four Golden Signals**:

1. **Latency**: P50 and P95 response times
2. **Traffic**: Requests per second by service
3. **Errors**: HTTP 5xx error rate percentage
4. **Saturation**: CPU and Memory usage gauges

Additional panels:
- Service uptime status
- Active alerts list
- SLO availability tracking

## Testing the System

### 1. Test Normal Operations

```bash
# SSH into VM
ssh root@10.13.104.221 -i privatekey

# Check all containers
docker ps

# Check logs
docker logs frontend-app
docker logs backend-app
docker logs mariadb-db
```

### 2. Test Application

1. Open frontend: `http://10.13.104.221:3000`
2. Add a student
3. Verify it appears in the list
4. Delete a student

### 3. Test Monitoring

1. Open Grafana: `http://10.13.104.221:3001`
2. Login with admin/admin
3. Navigate to the "INT531 SRE - Four Golden Signals" dashboard
4. Observe real-time metrics

### 4. Test Alerting

**Trigger High Error Rate Alert:**
```bash
# Click "Test Error Alert" button in frontend
# Or use curl:
for i in {1..100}; do
  curl http://10.13.104.221:3001/api/simulate-error
done
```

**Trigger High Latency Alert:**
```bash
# Click "Test Latency Alert" button in frontend
# Or use curl:
curl http://10.13.104.221:3001/api/simulate-slow
```

**Check alerts in Prometheus:**
```
http://10.13.104.221:9090/alerts
```

### 5. Chaos Testing Scenarios

**Kill Backend Container:**
```bash
ssh root@10.13.104.221 -i privatekey
docker kill backend-app

# Watch for Docker restart policy
docker ps -a | grep backend

# Check alert fired
curl http://10.13.104.221:9090/api/v1/alerts
```

**Simulate High CPU:**
```bash
ssh root@10.13.104.221 -i privatekey
stress --cpu 4 --timeout 600
```

**Simulate High Memory:**
```bash
stress --vm 2 --vm-bytes 1G --timeout 600
```

## Customization

### Change Discord Webhook for Alerts

Edit `roles/monitor/templates/alertmanager.yml.j2`:

```yaml
receivers:
  - name: 'discord-notifications'
    webhook_configs:
      - url: 'https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN'
```

Then redeploy monitoring:
```bash
ansible-playbook -i inventory.ini playbook.yml --tags monitor
```

### Add More Alert Rules

Edit `roles/monitor/templates/alert.rules.yml.j2` and add your custom alerts.

### Modify Application

Edit files in:
- `roles/app/files/frontend/` - Frontend code
- `roles/app/files/backend/` - Backend code

Then redeploy:
```bash
ansible-playbook -i inventory.ini playbook.yml --tags app
```

## Troubleshooting

### VM Creation Fails
```bash
# Check Proxmox API connectivity
ping 10.13.104.212

# Verify template exists
qm list | grep ubuntu-cloud-template
```

### Containers Not Starting
```bash
# SSH into VM
ssh root@10.13.104.221 -i privatekey

# Check Docker status
systemctl status docker

# Check container logs
docker logs backend-app

# Restart containers
cd /opt/app
docker compose down
docker compose up -d
```

### Prometheus Not Scraping Metrics
```bash
# Check Prometheus targets
curl http://10.13.104.221:9090/api/v1/targets

# Check backend metrics endpoint
curl http://10.13.104.221:3001/metrics
```

### Grafana Dashboard Not Loading
```bash
# Check Grafana logs
docker logs grafana

# Verify datasource
curl -u admin:admin http://10.13.104.221:3001/api/datasources
```

## Port Reference

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Web UI |
| Backend | 3001 | REST API |
| Database | 3306 | MariaDB |
| Prometheus | 9090 | Metrics & Alerts |
| Alertmanager | 9093 | Alert Management |
| Grafana | 3001 | Dashboards |
| Node Exporter | 9100 | System Metrics |

## Cleanup

To remove the VM and start fresh:

```bash
# The playbook automatically removes existing VM before creating new one
# Just run the playbook again
ansible-playbook -i inventory.ini playbook.yml
```

To manually remove:
```bash
# SSH to Proxmox
ssh root@10.13.104.212

# Stop and remove VM
qm stop <VM_ID>
qm destroy <VM_ID>
```

## References

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Ansible Documentation](https://docs.ansible.com/)
- [Google SRE Book - Four Golden Signals](https://sre.google/sre-book/monitoring-distributed-systems/)

## Support

For issues or questions:
1. Check Ansible playbook output for errors
2. Review logs in `/opt/app/` and `/opt/monitoring/`
3. Verify network connectivity
4. Ensure Proxmox template is properly configured

---

**Created for**: INT531 Site Reliability Engineering Final Capstone Project
**Institution**: King Mongkut's University of Technology Thonburi (KMUTT)
**Year**: 2025
