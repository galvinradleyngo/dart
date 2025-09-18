import { render, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { BoardView } from './App.jsx';
import { describe, it, expect, vi, beforeAll } from 'vitest';

const sampleTask = { id: 't1', title: 'Sample Task', status: 'todo', milestoneId: 'm1', order: 0 };

describe('BoardView mobile status selection', () => {
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

  const renderBoard = (status, onUpdate) =>
    render(
      <BoardView
        tasks={[{ ...sampleTask, status }]}
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

  const openSelect = () => {
    fireEvent.click(screen.getByRole('button', { name: /status/i }));
    return screen.getByLabelText('Status');
  };

  it('changes from todo to inprogress', () => {
    const onUpdate = vi.fn();
    renderBoard('todo', onUpdate);
    fireEvent.change(openSelect(), { target: { value: 'inprogress' } });
    expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'inprogress' });
  });

  it('changes from todo to blocked', () => {
    const onUpdate = vi.fn();
    renderBoard('todo', onUpdate);
    fireEvent.change(openSelect(), { target: { value: 'blocked' } });
    expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'blocked' });
  });

  it('changes from inprogress to done', () => {
    const onUpdate = vi.fn();
    renderBoard('inprogress', onUpdate);
    fireEvent.change(openSelect(), { target: { value: 'done' } });
    expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'done' });
  });

  it('changes from inprogress back to todo', () => {
    const onUpdate = vi.fn();
    renderBoard('inprogress', onUpdate);
    fireEvent.change(openSelect(), { target: { value: 'todo' } });
    expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'todo' });
  });

  it('changes from done back to inprogress', () => {
    const onUpdate = vi.fn();
    renderBoard('done', onUpdate);
    fireEvent.change(openSelect(), { target: { value: 'inprogress' } });
    expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'inprogress' });
  });

  it('shows blocked pill styling on board', () => {
    const onUpdate = vi.fn();
    renderBoard('blocked', onUpdate);
    const trigger = screen.getByRole('button', { name: /status: blocked/i });
    expect(trigger).toHaveClass('bg-orange-100');
  });

  it('updates button text after selection', async () => {
    const Wrapper = () => {
      const [tasks, setTasks] = useState([{ ...sampleTask }]);
      return (
        <BoardView
          tasks={tasks}
          team={[]}
          milestones={[]}
          onUpdate={(id, patch) =>
            setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)))
          }
          onDelete={() => {}}
          onDragStart={() => () => {}}
          onDragOverCol={() => {}}
          onDropToCol={() => () => {}}
          onAddLink={() => {}}
          onRemoveLink={() => {}}
          onDuplicate={() => {}}
        />
      );
    };
    render(<Wrapper />);
    expect(screen.queryByRole('combobox')).toBeNull();
    const button = screen.getByRole('button', { name: /status/i });
    expect(button).toHaveTextContent('To Do');
    fireEvent.click(button);
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'inprogress' },
    });
    await screen.findByRole('button', { name: /status: in progress/i });
  });

  it('renders blocked column header', () => {
    const onUpdate = vi.fn();
    renderBoard('todo', onUpdate);
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('allows editing start date when status is todo', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <BoardView
        tasks={[{ ...sampleTask }]}
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
    fireEvent.click(screen.getByTitle(/expand/i));
    const input = container.querySelector('input[type="date"]');
    expect(input).not.toBeDisabled();
    fireEvent.change(input, { target: { value: '2024-02-02' } });
    expect(onUpdate).toHaveBeenCalledWith('t1', { startDate: '2024-02-02', status: 'inprogress' });
  });
});
