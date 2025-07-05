import { McpErrorWrapper, McpErrorConfig, createMcpErrorWrapper } from './McpErrorWrapper';
import { ErrorHandler } from './ErrorHandler';
import { Logger } from '../../utils/logger';
import { 
  NetworkError, 
  TimeoutError, 
  AuthenticationError, 
  ValidationError,
  ConfigurationError 
} from './BaseError';

describe('McpErrorWrapper', () => {
  let errorHandler: jest.Mocked<ErrorHandler>;
  let logger: jest.Mocked<Logger>;
  let wrapper: McpErrorWrapper;

  beforeEach(() => {
    errorHandler = {
      handleError: jest.fn(),
      isRetryableError: jest.fn(),
    } as any;
    
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;
    
    wrapper = new McpErrorWrapper(errorHandler, logger);
  });

  describe('Error Classification', () => {
    it('should classify network errors correctly', async () => {
      const networkError = new Error('ENOTFOUND dns lookup failed');
      (networkError as any).code = 'ENOTFOUND';
      
      const context = { toolName: 'test_tool', arguments: {} };
      
      try {
        await wrapper.wrapToolExecution(
          async () => { throw networkError; },
          context
        );
      } catch (error) {
        // Error should be handled
      }
      
      expect(errorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ operation: 'tool_execution' }),
        expect.objectContaining({ severity: 'medium' })
      );
    });

    it('should classify timeout errors correctly', async () => {
      const timeoutError = new Error('Request timeout');
      (timeoutError as any).code = 'ETIMEDOUT';
      
      const context = { toolName: 'test_tool', arguments: {} };
      
      try {
        await wrapper.wrapToolExecution(
          async () => { throw timeoutError; },
          context
        );
      } catch (error) {
        // Error should be handled
      }
      
      expect(errorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ operation: 'tool_execution' }),
        expect.objectContaining({ severity: 'medium' })
      );
    });

    it('should classify authentication errors correctly', async () => {
      const authError = new Error('Unauthorized access');
      (authError as any).code = 'UNAUTHORIZED';
      
      const context = { toolName: 'test_tool', arguments: {} };
      
      try {
        await wrapper.wrapToolExecution(
          async () => { throw authError; },
          context
        );
      } catch (error) {
        // Error should be handled
      }
      
      expect(errorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ operation: 'tool_execution' }),
        expect.objectContaining({ severity: 'high' })
      );
    });

    it('should classify validation errors correctly', async () => {
      const validationError = new Error('Invalid input provided');
      (validationError as any).code = 'VALIDATION_FAILED';
      
      const context = { toolName: 'test_tool', arguments: {} };
      
      try {
        await wrapper.wrapToolExecution(
          async () => { throw validationError; },
          context
        );
      } catch (error) {
        // Error should be handled
      }
      
      expect(errorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ operation: 'tool_execution' }),
        expect.objectContaining({ severity: 'low' })
      );
    });
  });

  describe('Critical Tools Configuration', () => {
    it('should use default critical tools', () => {
      const config = wrapper.getConfig();
      expect(config.criticalTools).toEqual(['generate_content', 'save_post', 'publish_post']);
    });

    it('should use custom critical tools configuration', () => {
      const customConfig: Partial<McpErrorConfig> = {
        criticalTools: ['custom_tool_1', 'custom_tool_2'],
        criticalPrompts: ['custom_prompt_1']
      };
      
      const customWrapper = new McpErrorWrapper(errorHandler, logger, customConfig);
      const config = customWrapper.getConfig();
      
      expect(config.criticalTools).toEqual(['custom_tool_1', 'custom_tool_2']);
      expect(config.criticalPrompts).toEqual(['custom_prompt_1']);
    });

    it('should assign higher severity to critical tools', async () => {
      const error = new Error('Tool failed');
      const context = { toolName: 'generate_content', arguments: {} };
      
      try {
        await wrapper.wrapToolExecution(
          async () => { throw error; },
          context
        );
      } catch (error) {
        // Error should be handled
      }
      
      expect(errorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ operation: 'tool_execution' }),
        expect.objectContaining({ severity: 'high' })
      );
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration correctly', () => {
      const newConfig: Partial<McpErrorConfig> = {
        criticalTools: ['new_tool'],
        severityOverrides: { 'special_tool': 'critical' }
      };
      
      wrapper.updateConfig(newConfig);
      const config = wrapper.getConfig();
      
      expect(config.criticalTools).toEqual(['new_tool']);
      expect(config.severityOverrides).toEqual({ 'special_tool': 'critical' });
    });

    it('should apply severity overrides', async () => {
      wrapper.updateConfig({
        severityOverrides: { 'test_tool': 'critical' }
      });
      
      const error = new Error('Test error');
      const context = { toolName: 'test_tool', arguments: {} };
      
      try {
        await wrapper.wrapToolExecution(
          async () => { throw error; },
          context
        );
      } catch (error) {
        // Error should be handled
      }
      
      expect(errorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ operation: 'tool_execution' }),
        expect.objectContaining({ severity: 'critical' })
      );
    });
  });

  describe('Helper Functions', () => {
    it('should create wrapper with custom config', () => {
      const config: Partial<McpErrorConfig> = {
        criticalTools: ['helper_tool']
      };
      
      const helperWrapper = createMcpErrorWrapper(errorHandler, logger, config);
      const wrapperConfig = helperWrapper.getConfig();
      
      expect(wrapperConfig.criticalTools).toEqual(['helper_tool']);
    });
  });

  describe('Error Type Conversions', () => {
    it('should convert standard errors to typed errors', async () => {
      const networkError = new NetworkError('Network connection failed');
      const context = { toolName: 'test_tool', arguments: {} };
      
      try {
        await wrapper.wrapToolExecution(
          async () => { throw networkError; },
          context
        );
      } catch (error) {
        // Error should be handled
      }
      
      // The error should be properly classified as network error
      expect(errorHandler.handleError).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ operation: 'tool_execution' }),
        expect.objectContaining({ severity: 'medium' })
      );
    });
  });
});