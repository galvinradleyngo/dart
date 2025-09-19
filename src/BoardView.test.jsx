import { render, fireEvent, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { BoardView } from './App.jsx';
import { describe, it, expect, vi, beforeAll } from 'vitest';

const sampleTask = { id: 't1', title: 'Sample Task', status: 'todo', milestoneId: 'm1', order: 0 };
const teamWithPm = [
  { id: 'pm1', name: 'Pat Manager', roleType: 'PM' },
  { id: 'ld1', name: 'Lee Designer', roleType: 'LD' },
];

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

  const renderBoard = (status, onUpdate, extraProps = {}) =>
    render(
      <BoardView
        tasks={[{ ...sampleTask, status }]}
        team={teamWithPm}
        milestones={[]}
        onUpdate={onUpdate}
        onDelete={() => {}}
        onDragStart={() => () => {}}
        onDragOverCol={() => {}}
        onDropToCol={() => () => {}}
        onAddLink={() => {}}
        onRemoveLink={() => {}}
        onDuplicate={() => {}}
        reporter={teamWithPm[0]}
        {...extraProps}
      />
    );

  const openSelect = () => {
    fireEvent.click(screen.getByRole('button', { name: /status/i }));
    return screen.getByLabelText('Status');
  };

  it('includes skipped option in status menu', () => {
    const onUpdate = vi.fn();
    renderBoard('skip', onUpdate);
    const select = openSelect();
    expect(within(select).getByRole('option', { name: 'Skipped' })).toBeInTheDocument();
  });

  it('changes from todo to inprogress', () => {
    const onUpdate = vi.fn();
    renderBoard('todo', onUpdate);
    fireEvent.change(openSelect(), { target: { value: 'inprogress' } });
    expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'inprogress' });
  });

  it('prompts for block details before switching to blocked', () => {
    const onUpdate = vi.fn();
    renderBoard('todo', onUpdate);
    fireEvent.change(openSelect(), { target: { value: 'blocked' } });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(
      screen.getByRole('dialog', { name: /mark as blocked/i })
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/block description/i), {
      target: { value: 'Pending SME review' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add block/i }));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({
        status: 'blocked',
        blocks: [
          expect.objectContaining({
            description: 'Pending SME review',
            reportedBy: teamWithPm[0].id,
            taggedMemberIds: expect.arrayContaining([teamWithPm[0].id]),
          }),
        ],
      })
    );
  });

  it('allows cancelling the block dialog without updating', () => {
    const onUpdate = vi.fn();
    renderBoard('todo', onUpdate);
    fireEvent.change(openSelect(), { target: { value: 'blocked' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: /mark as blocked/i })).toBeNull();
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
    renderBoard('blocked', onUpdate, { reporter: teamWithPm[0] });
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

  it('renders skipped column header', () => {
    const onUpdate = vi.fn();
    renderBoard('todo', onUpdate);
    expect(screen.getByText('Skipped')).toBeInTheDocument();
  });

  it('shows skipped pill styling on board', () => {
    const onUpdate = vi.fn();
    renderBoard('skip', onUpdate, { reporter: teamWithPm[0] });
    const trigger = screen.getByRole('button', { name: /status: skipped/i });
    expect(trigger).toHaveClass('bg-pink-100');
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
