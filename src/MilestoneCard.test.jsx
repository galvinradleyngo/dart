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
});

