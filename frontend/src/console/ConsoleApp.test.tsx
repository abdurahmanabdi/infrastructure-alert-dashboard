import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ConsoleApp from './ConsoleApp';

function view(route = '/') {
  return render(<MemoryRouter initialEntries={[route]}><ConsoleApp /></MemoryRouter>);
}

describe('operations console', () => {
  test('labels the simulated dataset and exposes the main navigation', () => {
    view();
    expect(screen.getByRole('heading', { name: 'Operations overview' })).toBeTruthy();
    expect(screen.getByText(/simulated incidents, services and risk scores/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /Service topology/i })).toBeTruthy();
  });

  test('incident search narrows the visible table', () => {
    view('/incidents');
    const search = screen.getByRole('textbox', { name: 'Search incidents' });
    fireEvent.change(search, { target: { value: 'TLS renewal' } });
    const table = screen.getByRole('table');
    expect(within(table).getByText('TLS renewal window approaching')).toBeTruthy();
    expect(within(table).queryByText('Payment requests timing out')).toBeNull();
  });

  test('topology selection updates inspected component without the backend', () => {
    view('/topology');
    fireEvent.click(screen.getByRole('button', { name: /Primary Database, healthy, inspect component/i }));
    expect(screen.getByText('db-core')).toBeTruthy();
    expect(screen.getByText(/Potential blast radius/)).toBeTruthy();
  });
});
