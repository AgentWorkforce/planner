import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listPlans, type ListPlansParams } from '../plans';
import * as client from '../client';

// Mock the client module
vi.mock('../client', () => ({
  get: vi.fn(),
}));

describe('listPlans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should work with no parameters (legacy)', async () => {
    const mockResponse = { plans: [] };
    vi.mocked(client.get).mockResolvedValue(mockResponse);

    await listPlans();

    expect(client.get).toHaveBeenCalledWith('/plans?include_attention=true');
  });

  it('should work with status parameter (legacy)', async () => {
    const mockResponse = { plans: [] };
    vi.mocked(client.get).mockResolvedValue(mockResponse);

    await listPlans('draft');

    expect(client.get).toHaveBeenCalledWith('/plans?status=draft&include_attention=true');
  });

  it('should work with status and includeAttention=false (legacy)', async () => {
    const mockResponse = { plans: [] };
    vi.mocked(client.get).mockResolvedValue(mockResponse);

    await listPlans('approved', false);

    expect(client.get).toHaveBeenCalledWith('/plans?status=approved');
  });

  it('should work with all three legacy parameters', async () => {
    const mockResponse = { plans: [] };
    vi.mocked(client.get).mockResolvedValue(mockResponse);

    await listPlans('published', true, 'init-123');

    expect(client.get).toHaveBeenCalledWith(
      '/plans?status=published&initiative_id=init-123&include_attention=true'
    );
  });

  it('should work with new params object', async () => {
    const mockResponse = { plans: [] };
    vi.mocked(client.get).mockResolvedValue(mockResponse);

    const params: ListPlansParams = {
      status: 'draft',
      initiative_id: 'init-456',
      include_attention: true,
    };

    await listPlans(params);

    expect(client.get).toHaveBeenCalledWith(
      '/plans?status=draft&initiative_id=init-456&include_attention=true'
    );
  });

  it('should support owner_user_id in params object', async () => {
    const mockResponse = { plans: [] };
    vi.mocked(client.get).mockResolvedValue(mockResponse);

    const params: ListPlansParams = {
      owner_user_id: 'user-789',
      include_attention: false,
    };

    await listPlans(params);

    expect(client.get).toHaveBeenCalledWith('/plans?owner_user_id=user-789');
  });

  it('should include attention by default in params object', async () => {
    const mockResponse = { plans: [] };
    vi.mocked(client.get).mockResolvedValue(mockResponse);

    const params: ListPlansParams = {
      status: 'approved',
    };

    await listPlans(params);

    expect(client.get).toHaveBeenCalledWith('/plans?status=approved&include_attention=true');
  });

  it('should support all params together', async () => {
    const mockResponse = { plans: [] };
    vi.mocked(client.get).mockResolvedValue(mockResponse);

    const params: ListPlansParams = {
      status: 'published',
      initiative_id: 'init-123',
      owner_user_id: 'user-456',
      include_attention: false,
    };

    await listPlans(params);

    expect(client.get).toHaveBeenCalledWith(
      '/plans?status=published&initiative_id=init-123&owner_user_id=user-456'
    );
  });

  it('should handle empty params object', async () => {
    const mockResponse = { plans: [] };
    vi.mocked(client.get).mockResolvedValue(mockResponse);

    await listPlans({});

    expect(client.get).toHaveBeenCalledWith('/plans?include_attention=true');
  });
});
