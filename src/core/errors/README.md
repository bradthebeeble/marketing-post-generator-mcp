# Error Handling Improvements - McpErrorWrapper

## Overview

The `McpErrorWrapper` has been significantly improved to provide more robust, type-safe, and configurable error handling. The improvements address the previous issues with fragile string-based error detection and hardcoded critical tools lists.

## Key Improvements

### 1. Type-Safe Error Classification

**Before (Fragile String-Based):**
```typescript
if (error.message.includes('timeout') || error.message.includes('network')) {
  return 'medium';
}
```

**After (Type-Safe):**
```typescript
const classification = this.classifyError(error);
if (classification.isNetworkError) {
  return 'medium';
}
```

### 2. Configurable Critical Tools and Prompts

**Before (Hardcoded):**
```typescript
const criticalTools = ['generate_content', 'save_post', 'publish_post'];
```

**After (Configurable):**
```typescript
constructor(errorHandler, logger, config?: Partial<McpErrorConfig>) {
  this.config = {
    criticalTools: ['generate_content', 'save_post', 'publish_post'],
    criticalPrompts: ['content_generation', 'post_creation'],
    ...config
  };
}
```

### 3. Proper Error Type Checking

The system now includes specific error types:
- `NetworkError` - Network connectivity issues
- `TimeoutError` - Request timeout issues
- `AuthenticationError` - Authentication failures
- `AuthorizationError` - Authorization/permission issues
- `ValidationError` - Input validation failures
- `ConfigurationError` - Configuration/setup issues

### 4. Error Code Mapping

Errors are now classified based on error codes first, with message patterns as fallback:
```typescript
errorTypeMappings: {
  'ENOTFOUND': 'NetworkError',
  'ECONNREFUSED': 'NetworkError',
  'ETIMEDOUT': 'TimeoutError',
  'UNAUTHORIZED': 'AuthenticationError',
  // ... more mappings
}
```

## Configuration Interface

```typescript
interface McpErrorConfig {
  criticalTools: string[];
  criticalPrompts: string[];
  errorTypeMappings: Record<string, string>;
  severityOverrides: Record<string, 'low' | 'medium' | 'high' | 'critical'>;
}
```

## Usage Examples

### Basic Usage with Default Configuration
```typescript
const wrapper = new McpErrorWrapper(errorHandler, logger);
```

### Custom Configuration
```typescript
const customConfig: Partial<McpErrorConfig> = {
  criticalTools: ['my_critical_tool', 'another_tool'],
  criticalPrompts: ['important_prompt'],
  severityOverrides: {
    'special_tool': 'critical',
    'debug_tool': 'low'
  }
};

const wrapper = new McpErrorWrapper(errorHandler, logger, customConfig);
```

### Runtime Configuration Updates
```typescript
wrapper.updateConfig({
  criticalTools: [...wrapper.getConfig().criticalTools, 'new_tool']
});
```

### Using Helper Function
```typescript
const wrapper = createMcpErrorWrapper(errorHandler, logger, {
  criticalTools: ['tool1', 'tool2']
});
```

## Error Classification Process

1. **Check for severity overrides** - If a specific tool/prompt has a configured severity override, use it
2. **Check error type** - If the error is already a specific BaseError type, classify accordingly
3. **Check error codes** - Use the error code mapping for reliable classification
4. **Fallback to message patterns** - As a last resort, use regex patterns on error messages
5. **Apply context-based severity** - Increase severity for critical tools/prompts

## Benefits

1. **More Reliable** - Error codes are more reliable than message content
2. **Configurable** - Critical tools/prompts can be customized per deployment
3. **Type-Safe** - Proper TypeScript types prevent runtime errors
4. **Maintainable** - Clear separation of concerns and well-documented interfaces
5. **Extensible** - Easy to add new error types and classification rules

## Migration Guide

### For Existing Code
The wrapper is backward compatible. Existing code will continue to work with default configuration.

### For New Implementations
```typescript
// Old way
const wrapper = new McpErrorWrapper(errorHandler, logger);

// New way (with custom config)
const wrapper = new McpErrorWrapper(errorHandler, logger, {
  criticalTools: ['your_critical_tools'],
  severityOverrides: { 'tool_name': 'critical' }
});
```

### Error Handling Best Practices
1. Use specific error types when throwing errors
2. Include error codes when possible
3. Configure critical tools/prompts based on your application needs
4. Use severity overrides for special cases
5. Monitor error patterns to improve classification rules

## Testing

The improvements include comprehensive unit tests covering:
- Error classification for different error types
- Configuration management
- Severity determination logic
- Critical tools/prompts handling
- Error type conversions

Run tests with:
```bash
npm test src/core/errors/McpErrorWrapper.test.ts
```