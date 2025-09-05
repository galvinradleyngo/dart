import { render, fireEvent, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { BoardView } from './App.jsx';

const sampleTask = { id: 't1', title: 'Sample Task', status: 'todo', milestoneId: 'm1', order: 0 };

describe('BoardView status dropdown', () => {
  beforeAll(() => {
    window.matchMedia = window.matchMedia || (() => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));
  });

  it('updates task status via dropdown selection', () => {
    const onUpdate = vi.fn();
    render(
      <BoardView
        tasks={[sampleTask]}
        team={[]}
        milestones={[]}
        onUpdate={onUpdate}
        onDelete={() => {}}
        onDragStart={() => () => {}}
        onDragOverCol={() => {}}
        onDropToCol={() => () => {}}
        onAddLink={() => {}}
        onRemoveLink={() => {}}
        onDuplicate={() => {}}
      />
    );
    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'inprogress' } });
    expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'inprogress' });
  });
});
