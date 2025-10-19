# Contributing to Telegram Bot Template

Thank you for your interest in contributing to the Telegram Bot Template! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Submitting Changes](#submitting-changes)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Community](#community)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in your interactions.

### Expected Behavior

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

### Unacceptable Behavior

- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate

## Getting Started

### Prerequisites

- Node.js >= 20.18.0
- npm >= 10.0.0
- Git
- A code editor (VS Code recommended)
- Basic knowledge of TypeScript and Telegram Bot API

### Setup Development Environment

1. **Fork the repository** on GitHub

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/telegram-bot-template.git
   cd telegram-bot-template
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/telegram-bot-template.git
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your test bot credentials
   ```

6. **Create a test bot** using [@BotFather](https://t.me/botfather) for development

## Development Workflow

### 1. Create a Branch

Always create a new branch for your work:

```bash
git checkout -b feature/your-feature-name
```

Branch naming conventions:
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Adding or updating tests

### 2. Make Your Changes

- Write clean, readable code
- Follow the existing code style
- Add tests for new features
- Update documentation as needed
- Keep commits atomic and well-described

### 3. Test Your Changes

```bash
# Run tests
npm test

# Build the project
npm run build

# Test in development mode
npm run dev
```

### 4. Commit Your Changes

Write clear, concise commit messages:

```bash
git add .
git commit -m "feat: add user preference storage

- Add UserPreferences interface
- Implement preference storage service
- Add tests for preference CRUD operations

Closes #123"
```

Commit message format:
```
<type>: <subject>

<body>

<footer>
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### 5. Keep Your Branch Updated

```bash
git fetch upstream
git rebase upstream/main
```

### 6. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

## Coding Standards

### TypeScript Guidelines

- Use TypeScript strict mode
- Define interfaces for all data structures
- Use meaningful variable and function names
- Avoid `any` type unless absolutely necessary
- Document complex logic with comments

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add trailing commas in multiline objects/arrays
- Use async/await over promises where possible
- Keep functions small and focused (single responsibility)

Example:

```typescript
/**
 * Fetches user preferences from storage
 * @param userId - Telegram user ID
 * @returns User preferences or default values
 */
async function getUserPreferences(userId: number): Promise<UserPreferences> {
  try {
    const preferences = await storage.get(`user:${userId}:prefs`);
    return preferences || getDefaultPreferences();
  } catch (error) {
    logger.error('Failed to fetch user preferences', { userId, error });
    return getDefaultPreferences();
  }
}
```

### File Organization

- One class/interface per file (with related types)
- Group related functionality in directories
- Use index.ts for clean imports
- Keep files under 300 lines when possible

### Error Handling

- Always handle errors gracefully
- Log errors with context
- Provide user-friendly error messages
- Don't expose sensitive information in error messages

```typescript
try {
  await performOperation();
} catch (error) {
  logger.error('Operation failed', { context, error });
  await ctx.reply('Sorry, something went wrong. Please try again later.');
}
```

### Testing

- Write tests for new features
- Aim for >80% code coverage
- Test edge cases and error conditions
- Use descriptive test names

```typescript
describe('UserPreferences', () => {
  it('should return default preferences for new users', async () => {
    const prefs = await getUserPreferences(12345);
    expect(prefs).toEqual(getDefaultPreferences());
  });

  it('should throw error for invalid user ID', async () => {
    await expect(getUserPreferences(-1)).rejects.toThrow('Invalid user ID');
  });
});
```

## Submitting Changes

### Pull Request Process

1. **Update your branch** with latest main
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Ensure all tests pass**
   ```bash
   npm test
   npm run build
   ```

3. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Create Pull Request** on GitHub

### Pull Request Guidelines

- Use a clear, descriptive title
- Reference related issues (e.g., "Fixes #123")
- Describe what changes were made and why
- Include screenshots for UI changes
- List any breaking changes
- Update documentation if needed

### PR Template

```markdown
## Description
Brief description of changes

## Related Issue
Fixes #123

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests pass locally
- [ ] Added new tests
- [ ] Manual testing completed

## Screenshots (if applicable)

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Updated documentation
- [ ] No new warnings
- [ ] Added tests
- [ ] All tests pass
```

### Review Process

- Maintainers will review your PR
- Address any requested changes
- Once approved, a maintainer will merge

## Reporting Bugs

### Before Submitting

- Check if the bug has already been reported
- Try to reproduce with latest version
- Gather relevant information

### Bug Report Template

```markdown
**Bug Description**
Clear description of the bug

**To Reproduce**
Steps to reproduce:
1. Step one
2. Step two
3. See error

**Expected Behavior**
What you expected to happen

**Actual Behavior**
What actually happened

**Environment**
- OS: [e.g., Ubuntu 22.04]
- Node.js version: [e.g., 20.18.0]
- Template version: [e.g., 1.0.0]

**Error Logs**
```
Paste error logs here
```

**Additional Context**
Any other relevant information
```

## Suggesting Features

### Feature Request Template

```markdown
**Feature Description**
Clear description of the proposed feature

**Use Case**
Why is this feature needed? Who will benefit?

**Proposed Solution**
How you think this could be implemented

**Alternatives Considered**
Other approaches you've thought about

**Additional Context**
Screenshots, mockups, examples, etc.
```

## Community

### Getting Help

- **GitHub Discussions**: Ask questions, share ideas
- **Issues**: Report bugs, request features
- **Discord**: (If available) Real-time chat

### Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Given credit in commit history

## Development Tips

### Useful Commands

```bash
# Development with auto-reload
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Check TypeScript types
npm run build

# Format code (if formatter is setup)
npm run format

# Lint code (if linter is setup)
npm run lint
```

### Debugging

1. Use VS Code debugger with launch.json
2. Add `debugger` statements in code
3. Use `console.log` for quick debugging (remove before committing)
4. Check logs in `data/` directory

### Common Issues

**Build fails**: Delete `node_modules` and `dist`, then `npm install` and `npm run build`

**Tests fail**: Ensure `.env` is set up correctly, check if test bot token is valid

**Bot doesn't respond**: Verify bot token, check if bot is running, ensure privacy mode is disabled for groups

## Style Guide

### Documentation

- Use Markdown for documentation
- Include code examples
- Link to related docs
- Keep explanations clear and concise

### Comments

- Explain WHY, not WHAT
- Use JSDoc for public APIs
- Remove commented-out code before committing
- Keep comments up-to-date with code changes

### Naming Conventions

- `camelCase` for variables and functions
- `PascalCase` for classes and interfaces
- `UPPER_SNAKE_CASE` for constants
- Prefix interfaces with `I` (e.g., `IDataProvider`)
- Use descriptive names, avoid abbreviations

## Questions?

If you have questions about contributing, please:
1. Check existing documentation
2. Search closed issues
3. Ask in GitHub Discussions
4. Open a new issue if needed

Thank you for contributing to make this template better! 🎉
