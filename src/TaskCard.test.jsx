import { render, screen, fireEvent } from '@testing-library/react';
import TaskCard from './TaskCard';
import { describe, it, expect, vi } from 'vitest';

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

    // milestone select is visible by default
    expect(screen.getByRole('combobox')).toBeInTheDocument();

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

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'm2' } });
    expect(onUpdate).toHaveBeenCalledWith(sampleTask.id, { milestoneId: 'm2' });
  });
  it('updates status via dropdown', () => {
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
    fireEvent.change(screen.getByDisplayValue('todo'), { target: { value: 'inprogress' } });
    expect(onUpdate).toHaveBeenCalledWith(sampleTask.id, { status: 'inprogress' });
  });

  it('uses larger status select on mobile', () => {
    window.matchMedia = window.matchMedia || (() => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));
    render(
      <TaskCard
        task={sampleTask}
        milestones={milestones}
        onUpdate={() => {}}
        onDelete={() => {}}
        onDuplicate={() => {}}
      />
    );
    const statusSelect = screen.getByDisplayValue('todo');
    expect(statusSelect.className).toContain('text-sm');
  });
});
