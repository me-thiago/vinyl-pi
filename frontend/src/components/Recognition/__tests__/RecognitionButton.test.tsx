/**
 * Tests for RecognitionButton component (V2-07)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecognitionButton } from '../RecognitionButton';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'recognition.identify': 'Identificar música',
        'recognition.identifying': 'Identificando...',
        'recognition.success': 'Música identificada',
        'recognition.error': 'Erro ao identificar',
      };
      return translations[key] || key;
    },
  }),
}));

describe('RecognitionButton', () => {
  it('should render with idle state', () => {
    render(<RecognitionButton state="idle" />);
    
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('title', 'Identificar música');
    expect(button).not.toBeDisabled();
  });

  it('should render with loading state', () => {
    render(<RecognitionButton state="loading" />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Identificando...');
    
    // Check for spinning animation class on icon
    const icon = button.querySelector('svg');
    expect(icon).toHaveClass('animate-spin');
  });

  it('should render with success state', () => {
    render(<RecognitionButton state="success" />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Música identificada');
    expect(button).toHaveClass('bg-green-600');
  });

  it('should render with error state', () => {
    render(<RecognitionButton state="error" />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Erro ao identificar');
    expect(button).toHaveClass('bg-destructive');
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<RecognitionButton state="idle" onClick={handleClick} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not call onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<RecognitionButton state="idle" onClick={handleClick} disabled />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should not call onClick when loading', () => {
    const handleClick = vi.fn();
    render(<RecognitionButton state="loading" onClick={handleClick} />);
    
    const button = screen.getByRole('button');
    fireEvent.click(button);
    
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    render(<RecognitionButton state="idle" className="custom-class" />);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should be disabled when disabled prop is true', () => {
    render(<RecognitionButton state="idle" disabled />);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});
