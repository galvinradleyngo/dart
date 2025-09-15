import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MilestoneCard from './MilestoneCard.jsx';

const milestone = { id: 'm1', title: 'Milestone 1', goal: '', start: '' };

describe('MilestoneCard', () => {
  it('edits milestone title', () => {
    const onUpdateMilestone = vi.fn();
    render(<MilestoneCard milestone={milestone} onUpdateMilestone={onUpdateMilestone} />);

    const title = screen.getByText('Milestone 1');
    fireEvent.click(title);
    const input = screen.getByDisplayValue('Milestone 1');
    fireEvent.change(input, { target: { value: 'Updated Title' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter', charCode: 13 });

    expect(onUpdateMilestone).toHaveBeenCalledWith('m1', { title: 'Updated Title' });
  });

  it('renders progress bar color at 0%', () => {
    const tasks = [
      { id: 't1', status: 'todo' },
      { id: 't2', status: 'todo' },
    ];
    const { container } = render(<MilestoneCard milestone={milestone} tasks={tasks} />);
    const progressBar = container.querySelector('.h-2').firstElementChild;
    expect(progressBar.style.backgroundColor).toBe('rgb(236, 72, 153)');
  });

  it('renders progress bar color at 50%', () => {
    const tasks = [
      { id: 't1', status: 'done' },
      { id: 't2', status: 'todo' },
    ];
    const { container } = render(<MilestoneCard milestone={milestone} tasks={tasks} />);
    const progressBar = container.querySelector('.h-2').firstElementChild;
    expect(progressBar.style.backgroundColor).toBe('rgb(126, 129, 141)');
  });

  it('renders progress bar color at 100%', () => {
    const tasks = [
      { id: 't1', status: 'done' },
      { id: 't2', status: 'done' },
    ];
    const { container } = render(<MilestoneCard milestone={milestone} tasks={tasks} />);
    const progressBar = container.querySelector('.h-2').firstElementChild;
    expect(progressBar.style.backgroundColor).toBe('rgb(16, 185, 129)');
  });
});

