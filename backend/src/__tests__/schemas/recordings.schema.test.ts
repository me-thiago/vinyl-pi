import {
  startRecordingSchema,
  stopRecordingSchema,
  updateRecordingSchema,
  listRecordingsSchema,
} from '../../schemas/recordings.schema';

describe('Recordings Schemas', () => {
  describe('startRecordingSchema', () => {
    it('should validate valid input', () => {
      const validData = {
        albumId: '550e8400-e29b-41d4-a716-446655440000',
        fileName: 'My Recording',
      };

      const result = startRecordingSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should allow empty input', () => {
      const result = startRecordingSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should reject invalid UUID', () => {
      const invalidData = { albumId: 'not-a-uuid' };
      const result = startRecordingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject fileName longer than 255 chars', () => {
      const invalidData = { fileName: 'a'.repeat(256) };
      const result = startRecordingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('stopRecordingSchema', () => {
    it('should validate with recordingId', () => {
      const validData = { recordingId: '550e8400-e29b-41d4-a716-446655440000' };
      const result = stopRecordingSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should allow empty input', () => {
      const result = stopRecordingSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('updateRecordingSchema', () => {
    it('should validate partial update', () => {
      const validData = { fileName: 'Updated Name' };
      const result = updateRecordingSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should allow null albumId to unlink', () => {
      const validData = { albumId: null };
      const result = updateRecordingSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate UUID albumId', () => {
      const validData = { albumId: '550e8400-e29b-41d4-a716-446655440000' };
      const result = updateRecordingSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject fileName shorter than 1 char', () => {
      const invalidData = { fileName: '' };
      const result = updateRecordingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject notes longer than 1000 chars', () => {
      const invalidData = { notes: 'a'.repeat(1001) };
      const result = updateRecordingSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('listRecordingsSchema', () => {
    it('should validate with defaults', () => {
      const result = listRecordingsSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
        expect(result.data.offset).toBe(0);
        expect(result.data.sort).toBe('startedAt');
        expect(result.data.order).toBe('desc');
      }
    });

    it('should coerce string numbers', () => {
      const result = listRecordingsSchema.safeParse({ limit: '50', offset: '10' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(10);
      }
    });

    it('should validate albumId filter', () => {
      const validData = { albumId: '550e8400-e29b-41d4-a716-446655440000' };
      const result = listRecordingsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should validate status filter', () => {
      const validData = { status: 'completed' };
      const result = listRecordingsSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const invalidData = { status: 'invalid' };
      const result = listRecordingsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject limit > 100', () => {
      const invalidData = { limit: 101 };
      const result = listRecordingsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('should reject negative offset', () => {
      const invalidData = { offset: -1 };
      const result = listRecordingsSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });
});
