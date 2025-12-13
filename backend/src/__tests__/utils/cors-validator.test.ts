import {
  isLocalOrigin,
  resetAllowedOriginsCache,
  corsOriginCallback,
} from '../../utils/cors-validator';

describe('CORS Validator', () => {
  // Reset cache before each test to ensure isolation
  beforeEach(() => {
    resetAllowedOriginsCache();
    delete process.env.ALLOWED_ORIGINS;
  });

  afterEach(() => {
    resetAllowedOriginsCache();
    delete process.env.ALLOWED_ORIGINS;
  });

  describe('isLocalOrigin', () => {
    describe('same-origin requests (undefined origin)', () => {
      it('should allow requests without Origin header (same-origin)', () => {
        expect(isLocalOrigin(undefined)).toBe(true);
      });
    });

    describe('localhost validation', () => {
      it('should allow http://localhost', () => {
        expect(isLocalOrigin('http://localhost')).toBe(true);
      });

      it('should allow http://localhost with port', () => {
        expect(isLocalOrigin('http://localhost:3000')).toBe(true);
        expect(isLocalOrigin('http://localhost:8080')).toBe(true);
        expect(isLocalOrigin('http://localhost:80')).toBe(true);
      });

      it('should allow https://localhost', () => {
        expect(isLocalOrigin('https://localhost')).toBe(true);
      });

      it('should allow https://localhost with port', () => {
        expect(isLocalOrigin('https://localhost:443')).toBe(true);
        expect(isLocalOrigin('https://localhost:3001')).toBe(true);
      });

      it('should allow http://127.0.0.1', () => {
        expect(isLocalOrigin('http://127.0.0.1')).toBe(true);
      });

      it('should allow http://127.0.0.1 with port', () => {
        expect(isLocalOrigin('http://127.0.0.1:3000')).toBe(true);
        expect(isLocalOrigin('http://127.0.0.1:8080')).toBe(true);
      });

      it('should allow https://127.0.0.1', () => {
        expect(isLocalOrigin('https://127.0.0.1')).toBe(true);
        expect(isLocalOrigin('https://127.0.0.1:443')).toBe(true);
      });
    });

    describe('private network class C (192.168.x.x)', () => {
      it('should allow 192.168.0.x', () => {
        expect(isLocalOrigin('http://192.168.0.1')).toBe(true);
        expect(isLocalOrigin('http://192.168.0.100')).toBe(true);
        expect(isLocalOrigin('http://192.168.0.254')).toBe(true);
      });

      it('should allow 192.168.1.x', () => {
        expect(isLocalOrigin('http://192.168.1.1')).toBe(true);
        expect(isLocalOrigin('http://192.168.1.50')).toBe(true);
        expect(isLocalOrigin('http://192.168.1.100:8080')).toBe(true);
      });

      it('should allow 192.168.x.x with any valid subnet', () => {
        expect(isLocalOrigin('http://192.168.10.1')).toBe(true);
        expect(isLocalOrigin('http://192.168.100.50')).toBe(true);
        expect(isLocalOrigin('http://192.168.255.255')).toBe(true);
      });

      it('should allow 192.168.x.x with ports', () => {
        expect(isLocalOrigin('http://192.168.1.1:3000')).toBe(true);
        expect(isLocalOrigin('https://192.168.1.100:443')).toBe(true);
      });
    });

    describe('private network class A (10.x.x.x)', () => {
      it('should allow 10.0.0.x', () => {
        expect(isLocalOrigin('http://10.0.0.1')).toBe(true);
        expect(isLocalOrigin('http://10.0.0.100')).toBe(true);
      });

      it('should allow 10.x.x.x with any valid subnet', () => {
        expect(isLocalOrigin('http://10.1.1.1')).toBe(true);
        expect(isLocalOrigin('http://10.10.10.10')).toBe(true);
        expect(isLocalOrigin('http://10.100.200.50')).toBe(true);
        expect(isLocalOrigin('http://10.255.255.255')).toBe(true);
      });

      it('should allow 10.x.x.x with ports', () => {
        expect(isLocalOrigin('http://10.0.0.1:8080')).toBe(true);
        expect(isLocalOrigin('https://10.1.2.3:443')).toBe(true);
      });
    });

    describe('private network class B (172.16-31.x.x)', () => {
      it('should allow 172.16.x.x', () => {
        expect(isLocalOrigin('http://172.16.0.1')).toBe(true);
        expect(isLocalOrigin('http://172.16.100.50')).toBe(true);
      });

      it('should allow 172.17-30.x.x', () => {
        expect(isLocalOrigin('http://172.17.0.1')).toBe(true);
        expect(isLocalOrigin('http://172.20.10.100')).toBe(true);
        expect(isLocalOrigin('http://172.25.50.200')).toBe(true);
        expect(isLocalOrigin('http://172.30.255.255')).toBe(true);
      });

      it('should allow 172.31.x.x', () => {
        expect(isLocalOrigin('http://172.31.0.1')).toBe(true);
        expect(isLocalOrigin('http://172.31.255.255')).toBe(true);
      });

      it('should allow 172.16-31.x.x with ports', () => {
        expect(isLocalOrigin('http://172.16.0.1:3000')).toBe(true);
        expect(isLocalOrigin('https://172.31.100.50:443')).toBe(true);
      });

      it('should NOT allow 172.15.x.x (not private)', () => {
        expect(isLocalOrigin('http://172.15.0.1')).toBe(false);
        expect(isLocalOrigin('http://172.15.100.50')).toBe(false);
      });

      it('should NOT allow 172.32.x.x (not private)', () => {
        expect(isLocalOrigin('http://172.32.0.1')).toBe(false);
        expect(isLocalOrigin('http://172.32.100.50')).toBe(false);
      });
    });

    describe('Tailscale VPN (100.64-127.x.x)', () => {
      it('should allow 100.64.x.x (start of Tailscale range)', () => {
        expect(isLocalOrigin('http://100.64.0.1')).toBe(true);
        expect(isLocalOrigin('http://100.64.100.50')).toBe(true);
      });

      it('should allow 100.69.x.x (common Tailscale IP)', () => {
        expect(isLocalOrigin('http://100.69.209.71')).toBe(true);
        expect(isLocalOrigin('http://100.69.209.71:5173')).toBe(true);
      });

      it('should allow 100.100.x.x (middle of Tailscale range)', () => {
        expect(isLocalOrigin('http://100.100.100.100')).toBe(true);
        expect(isLocalOrigin('http://100.100.50.25:8080')).toBe(true);
      });

      it('should allow 100.127.x.x (end of Tailscale range)', () => {
        expect(isLocalOrigin('http://100.127.255.255')).toBe(true);
        expect(isLocalOrigin('http://100.127.0.1:3000')).toBe(true);
      });

      it('should allow Tailscale IPs with ports', () => {
        expect(isLocalOrigin('http://100.64.0.1:3000')).toBe(true);
        expect(isLocalOrigin('https://100.69.209.71:443')).toBe(true);
      });

      it('should NOT allow 100.63.x.x (before Tailscale range)', () => {
        expect(isLocalOrigin('http://100.63.0.1')).toBe(false);
        expect(isLocalOrigin('http://100.63.100.50')).toBe(false);
      });

      it('should NOT allow 100.128.x.x (after Tailscale range)', () => {
        expect(isLocalOrigin('http://100.128.0.1')).toBe(false);
        expect(isLocalOrigin('http://100.200.100.50')).toBe(false);
      });
    });

    describe('external origins (should be blocked)', () => {
      it('should block external domains', () => {
        expect(isLocalOrigin('https://evil.com')).toBe(false);
        expect(isLocalOrigin('https://malicious.net')).toBe(false);
        expect(isLocalOrigin('http://attacker.org')).toBe(false);
      });

      it('should block public IP addresses', () => {
        expect(isLocalOrigin('http://8.8.8.8')).toBe(false);
        expect(isLocalOrigin('http://1.1.1.1')).toBe(false);
        expect(isLocalOrigin('http://203.0.113.50')).toBe(false);
      });

      it('should block origins with paths', () => {
        // Origins should not have paths - only scheme://host:port
        expect(isLocalOrigin('http://localhost/path')).toBe(false);
        expect(isLocalOrigin('http://192.168.1.1/api')).toBe(false);
      });

      it('should block malformed origins', () => {
        expect(isLocalOrigin('localhost')).toBe(false);
        expect(isLocalOrigin('192.168.1.1')).toBe(false);
        expect(isLocalOrigin('ftp://192.168.1.1')).toBe(false);
      });

      it('should block spoofed local-looking domains', () => {
        expect(isLocalOrigin('http://localhost.evil.com')).toBe(false);
        expect(isLocalOrigin('http://192.168.1.1.evil.com')).toBe(false);
        expect(isLocalOrigin('http://evil-192.168.1.1.com')).toBe(false);
      });
    });
  });

  describe('ALLOWED_ORIGINS environment variable', () => {
    it('should allow origins from ALLOWED_ORIGINS', () => {
      process.env.ALLOWED_ORIGINS = 'https://trusted.com,http://custom.local';
      resetAllowedOriginsCache();

      expect(isLocalOrigin('https://trusted.com')).toBe(true);
      expect(isLocalOrigin('http://custom.local')).toBe(true);
    });

    it('should allow origins with extra whitespace', () => {
      process.env.ALLOWED_ORIGINS = '  https://trusted.com  ,  http://another.com  ';
      resetAllowedOriginsCache();

      expect(isLocalOrigin('https://trusted.com')).toBe(true);
      expect(isLocalOrigin('http://another.com')).toBe(true);
    });

    it('should still block origins not in list', () => {
      process.env.ALLOWED_ORIGINS = 'https://trusted.com';
      resetAllowedOriginsCache();

      expect(isLocalOrigin('https://trusted.com')).toBe(true);
      expect(isLocalOrigin('https://untrusted.com')).toBe(false);
    });

    it('should combine with local network origins', () => {
      process.env.ALLOWED_ORIGINS = 'https://external-allowed.com';
      resetAllowedOriginsCache();

      // Local origins should still work
      expect(isLocalOrigin('http://localhost:3000')).toBe(true);
      expect(isLocalOrigin('http://192.168.1.1:8080')).toBe(true);

      // And the allowed external origin
      expect(isLocalOrigin('https://external-allowed.com')).toBe(true);

      // But other externals should be blocked
      expect(isLocalOrigin('https://evil.com')).toBe(false);
    });

    it('should handle empty ALLOWED_ORIGINS', () => {
      process.env.ALLOWED_ORIGINS = '';
      resetAllowedOriginsCache();

      // Local origins should still work
      expect(isLocalOrigin('http://localhost:3000')).toBe(true);
      // External should be blocked
      expect(isLocalOrigin('https://evil.com')).toBe(false);
    });

    it('should handle ALLOWED_ORIGINS with empty entries', () => {
      process.env.ALLOWED_ORIGINS = 'https://valid.com,,  ,,https://another.com';
      resetAllowedOriginsCache();

      expect(isLocalOrigin('https://valid.com')).toBe(true);
      expect(isLocalOrigin('https://another.com')).toBe(true);
    });
  });

  describe('corsOriginCallback', () => {
    it('should call callback with true for allowed origins', (done) => {
      corsOriginCallback('http://localhost:3000', (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('should call callback with true for undefined origin', (done) => {
      corsOriginCallback(undefined, (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('should call callback with true for local network IP', (done) => {
      corsOriginCallback('http://192.168.1.100:8080', (err, allow) => {
        expect(err).toBeNull();
        expect(allow).toBe(true);
        done();
      });
    });

    it('should call callback with error for blocked origins', (done) => {
      corsOriginCallback('https://evil.com', (err, allow) => {
        expect(err).toBeInstanceOf(Error);
        expect(err?.message).toBe('Origem não permitida pelo CORS');
        expect(allow).toBeUndefined();
        done();
      });
    });

    it('should call callback with error for public IPs', (done) => {
      corsOriginCallback('http://8.8.8.8', (err, allow) => {
        expect(err).toBeInstanceOf(Error);
        expect(err?.message).toBe('Origem não permitida pelo CORS');
        done();
      });
    });
  });

  describe('resetAllowedOriginsCache', () => {
    it('should reset the cache allowing new ALLOWED_ORIGINS to take effect', () => {
      // First set
      process.env.ALLOWED_ORIGINS = 'https://first.com';
      resetAllowedOriginsCache();
      expect(isLocalOrigin('https://first.com')).toBe(true);
      expect(isLocalOrigin('https://second.com')).toBe(false);

      // Change env and reset
      process.env.ALLOWED_ORIGINS = 'https://second.com';
      resetAllowedOriginsCache();
      expect(isLocalOrigin('https://first.com')).toBe(false);
      expect(isLocalOrigin('https://second.com')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle IPv6 localhost (not in current implementation)', () => {
      // Current implementation doesn't support IPv6
      // This documents expected behavior
      expect(isLocalOrigin('http://[::1]:3000')).toBe(false);
    });

    it('should handle empty string origin', () => {
      expect(isLocalOrigin('')).toBe(false);
    });

    it('should be case-sensitive for protocol', () => {
      // HTTP/HTTPS should work
      expect(isLocalOrigin('http://localhost')).toBe(true);
      expect(isLocalOrigin('https://localhost')).toBe(true);
      // But uppercase should not (browsers send lowercase)
      expect(isLocalOrigin('HTTP://localhost')).toBe(false);
    });
  });
});
