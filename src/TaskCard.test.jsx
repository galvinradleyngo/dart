import { render, screen, fireEvent } from '@testing-library/react';
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

  describe('swipe status transitions', () => {
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
      return screen.getByTestId('task-card');
    };

    const swipe = (element, dx) => {
      fireEvent.touchStart(element, { touches: [{ clientX: 0 }] });
      fireEvent.touchEnd(element, { changedTouches: [{ clientX: dx }] });
    };

    it('swipe right from todo moves to inprogress', () => {
      const onUpdate = vi.fn();
      const card = renderWithStatus('todo', onUpdate);
      expect(card.hasAttribute('draggable')).toBe(false);
      swipe(card, 100);
      expect(onUpdate).toHaveBeenCalledWith(sampleTask.id, { status: 'inprogress' });
    });

    it('swipe left from todo stays at todo', () => {
      const onUpdate = vi.fn();
      const card = renderWithStatus('todo', onUpdate);
      expect(card.hasAttribute('draggable')).toBe(false);
      swipe(card, -100);
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('swipe right from inprogress moves to done', () => {
      const onUpdate = vi.fn();
      const card = renderWithStatus('inprogress', onUpdate);
      expect(card.hasAttribute('draggable')).toBe(false);
      swipe(card, 100);
      expect(onUpdate).toHaveBeenCalledWith(sampleTask.id, { status: 'done' });
    });

    it('swipe left from inprogress moves to todo', () => {
      const onUpdate = vi.fn();
      const card = renderWithStatus('inprogress', onUpdate);
      expect(card.hasAttribute('draggable')).toBe(false);
      swipe(card, -100);
      expect(onUpdate).toHaveBeenCalledWith(sampleTask.id, { status: 'todo' });
    });

    it('swipe left from done moves to inprogress', () => {
      const onUpdate = vi.fn();
      const card = renderWithStatus('done', onUpdate);
      expect(card.hasAttribute('draggable')).toBe(false);
      swipe(card, -100);
      expect(onUpdate).toHaveBeenCalledWith(sampleTask.id, { status: 'inprogress' });
    });

    it('swipe right from done stays at done', () => {
      const onUpdate = vi.fn();
      const card = renderWithStatus('done', onUpdate);
      expect(card.hasAttribute('draggable')).toBe(false);
      swipe(card, 100);
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe('mobile status control', () => {
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

    it('replaces status dropdown with pill and updates text on swipe', async () => {
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
      expect(screen.getByText('To Do')).toBeInTheDocument();
      const card = screen.getByTestId('task-card');
      expect(card.hasAttribute('draggable')).toBe(false);
      fireEvent.touchStart(card, { touches: [{ clientX: 0 }] });
      fireEvent.touchEnd(card, { changedTouches: [{ clientX: 100 }] });
      await screen.findByText('In Progress');
    });
  });
});
