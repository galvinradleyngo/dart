import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useState } from 'react';
import TaskCard from './TaskCard';
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Sample task data
const sampleTask = {
  id: 't1',
  title: 'Sample Task',
  details: 'Task details',
  note: '',
  status: 'todo',
  milestoneId: 'm1',
};

const milestones = [
  { id: 'm1', title: 'Milestone 1' },
  { id: 'm2', title: 'Milestone 2' },
];

describe('TaskCard', () => {
  it('toggles expand/collapse', () => {
    render(
      <TaskCard
        task={sampleTask}
        milestones={milestones}
        onUpdate={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
      />
    );

    // milestone text is visible by default
    expect(screen.getByText('Milestone 1')).toBeInTheDocument();

    const toggleBtn = screen.getByTitle(/expand/i);
    fireEvent.click(toggleBtn);
    // expanded content reveals start label
    expect(screen.getByText(/start/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTitle(/collapse/i));
    expect(screen.queryByText(/start/i)).toBeNull();
  });

  it('triggers duplicate and delete callbacks', () => {
    const onDuplicate = vi.fn();
    const onDelete = vi.fn();
    render(
      <TaskCard
        task={sampleTask}
        milestones={milestones}
        onUpdate={() => {}}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
      />
    );

    fireEvent.click(screen.getByTitle(/duplicate/i));
    expect(onDuplicate).toHaveBeenCalledWith(sampleTask.id);

    fireEvent.click(screen.getByTitle(/delete/i));
    expect(onDelete).toHaveBeenCalledWith(sampleTask.id);
  });

  it('updates milestone tag', () => {
    const onUpdate = vi.fn();
    render(
      <TaskCard
        task={sampleTask}
        milestones={milestones}
        onUpdate={onUpdate}
        onDelete={() => {}}
        onDuplicate={() => {}}
      />
    );

    fireEvent.click(screen.getByTitle(/expand/i));
    fireEvent.click(screen.getByLabelText(/edit milestone/i));
    fireEvent.change(screen.getByLabelText('Milestone'), { target: { value: 'm2' } });
    expect(onUpdate).toHaveBeenCalledWith(sampleTask.id, { milestoneId: 'm2' });
  });

  it('updates assignee while collapsed', () => {
    const onUpdate = vi.fn();
    const team = [
      { id: 'u1', name: 'User One', roleType: 'Dev' },
      { id: 'u2', name: 'User Two', roleType: 'QA' },
    ];
    render(
      <TaskCard
        task={{ ...sampleTask, assigneeId: 'u1' }}
        milestones={milestones}
        team={team}
        onUpdate={onUpdate}
        onDelete={() => {}}
        onDuplicate={() => {}}
      />
    );

    fireEvent.change(screen.getByLabelText('Assignee'), { target: { value: 'u2' } });
    expect(onUpdate).toHaveBeenCalledWith(sampleTask.id, { assigneeId: 'u2' });
  });

  it('allows editing start date when status is todo', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <TaskCard
        task={sampleTask}
        milestones={milestones}
        onUpdate={onUpdate}
        onDelete={() => {}}
        onDuplicate={() => {}}
      />
    );
    fireEvent.click(screen.getByTitle(/expand/i));
    const input = container.querySelector('input[type="date"]');
    expect(input).not.toBeDisabled();
    fireEvent.change(input, { target: { value: '2024-01-01' } });
    expect(onUpdate).toHaveBeenCalledWith(sampleTask.id, { startDate: '2024-01-01', status: 'inprogress' });
  });

  describe('mobile status selection', () => {
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

    const renderWithStatus = (status, onUpdate) => {
      render(
        <TaskCard
          task={{ ...sampleTask, status }}
          milestones={milestones}
          onUpdate={onUpdate}
          onDelete={() => {}}
          onDuplicate={() => {}}
        />
      );
      fireEvent.click(screen.getByRole('button', { name: /status/i }));
      return screen.getByLabelText('Status');
    };

    it('changes from todo to inprogress', () => {
      const onUpdate = vi.fn();
      const select = renderWithStatus('todo', onUpdate);
      fireEvent.change(select, { target: { value: 'inprogress' } });
      expect(onUpdate).toHaveBeenCalledWith(sampleTask.id, { status: 'inprogress' });
    });

    it('changes from inprogress to done', () => {
      const onUpdate = vi.fn();
      const select = renderWithStatus('inprogress', onUpdate);
      fireEvent.change(select, { target: { value: 'done' } });
      expect(onUpdate).toHaveBeenCalledWith(sampleTask.id, { status: 'done' });
    });

    it('changes from inprogress back to todo', () => {
      const onUpdate = vi.fn();
      const select = renderWithStatus('inprogress', onUpdate);
      fireEvent.change(select, { target: { value: 'todo' } });
      expect(onUpdate).toHaveBeenCalledWith(sampleTask.id, { status: 'todo' });
    });

    it('changes from done back to inprogress', () => {
      const onUpdate = vi.fn();
      const select = renderWithStatus('done', onUpdate);
      fireEvent.change(select, { target: { value: 'inprogress' } });
      expect(onUpdate).toHaveBeenCalledWith(sampleTask.id, { status: 'inprogress' });
    });

    it('updates button text after selection', async () => {
      const Wrapper = () => {
        const [task, setTask] = useState(sampleTask);
        return (
          <TaskCard
            task={task}
            milestones={milestones}
            onUpdate={(id, patch) => setTask((t) => ({ ...t, ...patch }))}
            onDelete={() => {}}
            onDuplicate={() => {}}
          />
        );
      };
      render(<Wrapper />);
      expect(screen.getAllByRole('combobox').length).toBe(1);
      const button = screen.getByRole('button', { name: /status/i });
      expect(button).toHaveTextContent('To Do');
      fireEvent.click(button);
      fireEvent.change(screen.getByLabelText('Status'), {
        target: { value: 'inprogress' },
      });
      await screen.findByRole('button', { name: /status: in progress/i });
    });
  });

  it('prompts for link when completing without one', () => {
    const onUpdate = vi.fn();
    render(
      <TaskCard
        task={{ ...sampleTask, links: [] }}
        milestones={milestones}
        onUpdate={onUpdate}
        onDelete={() => {}}
        onDuplicate={() => {}}
      />
    );
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'done' } });
    expect(screen.getByText('Please provide a link to the output')).toBeInTheDocument();
    expect(onUpdate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('No link'));
    expect(onUpdate).toHaveBeenCalledWith(sampleTask.id, { status: 'done' });
  });

  it('does not fire confetti when mounting a completed task', async () => {
    render(
      <TaskCard
        task={{ ...sampleTask, status: 'done', links: ['https://example.com'] }}
        milestones={milestones}
        onUpdate={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
      />
    );

    await waitFor(() => {
      expect(document.querySelector('[data-confetti]')).toBeNull();
    });
  });

  it('fires confetti when status transitions to done', async () => {
    const { rerender, unmount } = render(
      <TaskCard
        task={{ ...sampleTask, status: 'inprogress', links: ['https://example.com'] }}
        milestones={milestones}
        onUpdate={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
      />
    );

    expect(document.querySelector('[data-confetti]')).toBeNull();

    rerender(
      <TaskCard
        task={{ ...sampleTask, status: 'done', links: ['https://example.com'] }}
        milestones={milestones}
        onUpdate={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
      />
    );

    await waitFor(() => {
      expect(document.querySelector('[data-confetti]')).not.toBeNull();
    });

    unmount();
    expect(document.querySelector('[data-confetti]')).toBeNull();
  });
});
