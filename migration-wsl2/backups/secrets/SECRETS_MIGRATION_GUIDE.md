# 🔐 PACADEV Secrets Migration Guide

## Overview
All PACADEV secrets are encrypted using SOPS + age. The age key is required to decrypt them.

## Critical Files
- **age-keys-XXXXXX.txt** → Encryption key (KEEP SECURE!)
- **secrets-encrypted-XXXXXX.tar.gz** → All .enc.yaml files

## WSL2 Installation Steps

### 1. Copy Age Key to WSL2
```bash
# On Windows PowerShell:
wsl cp /mnt/c/backup/age-keys-XXXXXX.txt /home/abdelali/.config/sops/age/keys.txt

# Then make it read-only:
wsl chmod 600 /home/abdelali/.config/sops/age/keys.txt
```

### 2. Extract Encrypted Secrets
```bash
cd /home/abdelali/pacadev
tar -xzf /path/to/secrets-encrypted-XXXXXX.tar.gz
```

### 3. Verify SOPS + Age Installation
```bash
# Install SOPS if not already present
brew install sops age

# Test decryption (should not error)
sops -d core/secrets/pacadev_infra.enc.yaml
```

### 4. Use Secrets in WSL2
```bash
# Decrypt and load into env:
eval $(sops -d core/secrets/pacadev_infra.enc.yaml | yq 'to_entries | .[] | "export \(.key)=\(.value)"')

# Or directly for docker-compose:
export $(sops -d core/secrets/pacadev_infra.enc.yaml | yq -r 'to_entries[] | "\(.key)=\(.value)"')
docker-compose up -d
```

## Troubleshooting

### "age: could not decrypt" error
- Age key is missing or corrupted
- Verify `~/.config/sops/age/keys.txt` exists
- Check permissions: should be `600`

### "sops: command not found"
- Install SOPS: `brew install sops` or `apt install sops`
- Install age: `brew install age` or `apt install age-encryption`

### "No such file or directory" for .enc.yaml
- Make sure secrets directory was extracted correctly
- Check: `ls -la /home/abdelali/pacadev/core/secrets/`

## Security Considerations
- ❌ Never commit unencrypted secrets to git
- ❌ Never share the age key
- ✅ Keep age-keys-XXXXXX.txt in a secure location
- ✅ Use SOPS for all new secrets

