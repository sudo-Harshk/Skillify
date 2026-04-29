import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('axios', () => ({
  __esModule: true,
  default: {
    create: jest.fn(() => ({
      get: jest.fn(),
      post: jest.fn(),
    })),
  },
}));

test('renders app header', () => {
  render(<App />);
  expect(screen.getByText(/Skillify/i)).toBeInTheDocument();
});
