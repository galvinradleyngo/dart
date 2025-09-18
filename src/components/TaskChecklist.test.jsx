import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import TaskChecklist from './TaskChecklist.jsx';

const baseTask = {
  id: 'task-1',
  title: 'Sample Task',
  status: 'todo',
  milestoneId: null,
};

afterEach(() => {
  cleanup();
  document.querySelectorAll('[data-confetti]').forEach((node) => {
    if (node.parentNode) {
      node.parentNode.removeChild(node);
    }
  });
});

describe('TaskChecklist', () => {
  it('fires confetti when marking a task as done', async () => {
    const onUpdate = vi.fn();
    render(
      <TaskChecklist
        tasks={[{ ...baseTask }]}
        team={[]}
        milestones={[]}
        onUpdate={onUpdate}
        onEdit={() => {}}
      />
    );

    const checkbox = screen.getByLabelText('Sample Task for Unassigned');
    fireEvent.click(checkbox);

    expect(onUpdate).toHaveBeenCalledWith('task-1', { status: 'done' });

    await waitFor(() => {
      expect(document.querySelector('[data-confetti]')).not.toBeNull();
    });
  });
});
