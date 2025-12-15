run playbook by

`` ansible-playbook -i inventory.ini [playbook].yml ``

# ‼️ Important before running

Be sure to check 
[ ] playbook.yml
[ ] playbook-vm-config.yml
[ ] inventory.ini
[ ] ssh private key in the folder

remove all # comment and replace the placeholder value preceeding them with your own value

# Intended flow

1. Create Proxmox VM template ([guide](https://docs.google.com/document/d/1rugRbAGY0BACRm1YzdM2rtt1QqFCidJpAVAVOzcMRmo/edit?tab=t.0))
2. Replace playbook.yml variables with your own variable (lines with #)
3. Run `` ansible-playbook -i inventory.ini playbook.yml ``
4. Wait for ansible to finish
5. Check the VM is created on proxmox
6. Get the IP address from the newly created VM and replace the inventory.ini and playbook-vm-config.yml
7. Replace playbook-vm-config.yml variables
8. Run `` ansible-playbook -i inventory.ini playbook-vm-config.yml ``
9. ssh to the new VM and check if hostname is changed

feel free to reach out to Electric Nutbuster on discord for issue

rule is not used right now. because we don't need to reuse docker install rule.