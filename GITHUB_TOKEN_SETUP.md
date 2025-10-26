# GitHub Token Setup Guide

## Steps to create a GitHub Personal Access Token:

1. **Go to GitHub Settings**

   - Navigate to https://github.com/settings/tokens
   - Or: Click your profile picture (top right) → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **Generate new token**

   - Click "Generate new token" → "Generate new token (classic)"
   - You may need to confirm your password

3. **Configure the token**

   - **Note**: Give it a descriptive name like "PR Description CLI"
   - **Expiration**: Choose your preferred expiration (30 days, 60 days, 90 days, or no expiration)
   - **Select scopes**: Check the `repo` box
     - This grants full control of private repositories
     - Includes access to read/write PR data

4. **Generate and copy**

   - Click "Generate token" at the bottom
   - **IMPORTANT**: Copy the token immediately (starts with `ghp_`)
   - You won't be able to see it again!

5. **Set the environment variable**

   ```bash
   export GITHUB_PRD_TOKEN="ghp_your_token_here"
   ```

   Or add it to your shell profile (~/.zshrc or ~/.bashrc):

   ```bash
   echo 'export GITHUB_PRD_TOKEN="ghp_your_token_here"' >> ~/.zshrc
   source ~/.zshrc
   ```

## Security Notes:

- Never commit this token to git
- Store it securely (password manager recommended)
- Revoke it if compromised at https://github.com/settings/tokens
- Use minimal expiration time that works for your needs
