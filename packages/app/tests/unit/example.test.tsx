import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

// Sample component for testing
function SampleComponent() {
  return <div>Hello World</div>;
}

describe('SampleComponent', () => {
  it('renders hello world text', () => {
    render(<SampleComponent />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });
});
