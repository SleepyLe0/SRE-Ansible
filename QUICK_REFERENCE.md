# Quick Reference Card - INT531 SRE Ansible

## 1. Deploy Everything

```bash
cd ansible-example
ansible-playbook -i inventory.ini playbook.yml
```

## 2. Access URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://10.13.104.221:3000 | - |
| Backend API | http://10.13.104.221:3001 | - |
| Prometheus | http://10.13.104.221:9090 | - |
| Grafana | http://10.13.104.221:3001 | admin/admin |
| Alertmanager | http://10.13.104.221:9093 | - |

## 3. SSH Access

```bash
ssh root@10.13.104.221 -i privatekey
```

## 4. Docker Commands

```bash
# List all containers
docker ps

# View logs
docker logs frontend-app
docker logs backend-app
docker logs mariadb-db
docker logs prometheus
docker logs grafana

# Restart a container
docker restart backend-app

# Restart all application containers
cd /opt/app
docker compose restart

# Stop all containers
docker compose down

# Start all containers
docker compose up -d
```

## 5. Check Services

```bash
# Application containers
curl http://10.13.104.221:3000/health    # Frontend
curl http://10.13.104.221:3001/health    # Backend
curl http://10.13.104.221:3001/metrics   # Backend metrics

# Monitoring services
curl http://10.13.104.221:9090/-/healthy # Prometheus
curl http://10.13.104.221:9093/-/healthy # Alertmanager
curl http://10.13.104.221:9100/metrics   # Node Exporter
```

## 6. Trigger Test Alerts

```bash
# High error rate
for i in {1..100}; do
  curl http://10.13.104.221:3001/api/simulate-error
done

# High latency
curl http://10.13.104.221:3001/api/simulate-slow

# Service down
docker kill backend-app

# High CPU
ssh root@10.13.104.221 -i privatekey
apt install stress -y
stress --cpu 4 --timeout 600

# High memory
stress --vm 2 --vm-bytes 1G --timeout 600
```

## 7. Check Alerts

```bash
# Prometheus alerts
curl http://10.13.104.221:9090/api/v1/alerts

# Or visit in browser:
# http://10.13.104.221:9090/alerts
```

## 8. Database Access

```bash
# Connect to MariaDB
docker exec -it mariadb-db mysql -u appuser -papppassword students_db

# Show students
SELECT * FROM students;

# Exit
exit
```

## 9. View Logs

```bash
# Application logs
docker logs -f backend-app    # Follow logs

# System logs
journalctl -u docker -f       # Docker service logs
journalctl -u node_exporter   # Node Exporter logs
```

## 10. Restart Services

```bash
# Restart application
cd /opt/app
docker compose restart

# Restart monitoring
docker restart prometheus
docker restart grafana
docker restart alertmanager

# Restart Node Exporter
systemctl restart node_exporter
```

## 11. Update Configuration

```bash
# After editing configs, reload Prometheus
docker exec prometheus kill -HUP 1

# Or restart
docker restart prometheus

# Reload Alertmanager
docker exec alertmanager kill -HUP 1
```

## 12. Verify Deployment

```bash
# Check all ports are listening
ss -tlnp | grep -E '3000|3001|3306|9090|9093|9100'

# Check Prometheus targets
curl http://10.13.104.221:9090/api/v1/targets

# Check disk usage
df -h

# Check memory
free -h

# Check CPU
top
```

## 13. Backup Database

```bash
# Export database
docker exec mariadb-db mysqldump -u root -prootpassword students_db > backup.sql

# Import database
docker exec -i mariadb-db mysql -u root -prootpassword students_db < backup.sql
```

## 14. Common Issues

### Backend won't start
```bash
docker logs backend-app
# Check if database is ready
docker exec mariadb-db mysqladmin -u root -prootpassword ping
```

### Prometheus not scraping
```bash
# Check config syntax
docker exec prometheus promtool check config /etc/prometheus/prometheus.yml

# View targets
curl http://10.13.104.221:9090/api/v1/targets
```

### Grafana dashboard not loading
```bash
# Check datasource
curl -u admin:admin http://10.13.104.221:3001/api/datasources

# Restart Grafana
docker restart grafana
```

## 15. Performance Testing

```bash
# Install Apache Bench
apt install apache2-utils -y

# Load test
ab -n 10000 -c 100 http://10.13.104.221:3001/api/students

# Monitor during test
watch -n 1 'docker stats --no-stream'
```

## 16. Cleanup

```bash
# Remove all containers and volumes
cd /opt/app
docker compose down -v

# Remove monitoring containers
docker rm -f prometheus grafana alertmanager

# Stop Node Exporter
systemctl stop node_exporter
```

## 17. Re-deploy After Changes

```bash
# Re-deploy application only
ansible-playbook -i inventory.ini playbook.yml --tags app

# Re-deploy monitoring only
ansible-playbook -i inventory.ini playbook.yml --tags monitor

# Re-deploy everything
ansible-playbook -i inventory.ini playbook.yml
```

## 18. Useful Prometheus Queries

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
```

## 19. File Locations

```
Application:
  /opt/app/                           - Application root
  /opt/app/docker-compose.yml         - Compose file
  /opt/app/frontend/                  - Frontend code
  /opt/app/backend/                   - Backend code

Monitoring:
  /opt/monitoring/prometheus/         - Prometheus config & data
  /opt/monitoring/grafana/            - Grafana data & dashboards
  /opt/monitoring/alertmanager/       - Alertmanager config & data

Logs:
  docker logs [container-name]        - Container logs
  /var/log/syslog                     - System logs
  journalctl -u [service-name]        - Service logs
```

## 20. Emergency Contacts

If alerts fire during chaos testing:

1. Check Prometheus alerts: http://10.13.104.221:9090/alerts
2. Check Grafana dashboard for metrics
3. SSH into VM and check container status
4. Review logs for root cause
5. Implement mitigation from SRE Runbook

---

**Pro Tip**: Bookmark this file for quick access during demos and chaos testing!
