import { render, fireEvent, screen } from '@testing-library/react';
import { useState } from 'react';
import { BoardView } from './App.jsx';
import { describe, it, expect, vi, beforeAll } from 'vitest';

const sampleTask = { id: 't1', title: 'Sample Task', status: 'todo', milestoneId: 'm1', order: 0 };

describe('BoardView swipe transitions', () => {
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

  const swipe = (element, dx) => {
    fireEvent.touchStart(element, { touches: [{ clientX: 0 }] });
    fireEvent.touchEnd(element, { changedTouches: [{ clientX: dx }] });
  };

  it('swipe right from todo moves to inprogress', () => {
    const onUpdate = vi.fn();
    renderBoard('todo', onUpdate);
    const card = screen.getByTestId('task-card');
    expect(card.hasAttribute('draggable')).toBe(false);
    swipe(card, 100);
    expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'inprogress' });
  });

  it('swipe left from todo stays at todo', () => {
    const onUpdate = vi.fn();
    renderBoard('todo', onUpdate);
    const card = screen.getByTestId('task-card');
    expect(card.hasAttribute('draggable')).toBe(false);
    swipe(card, -100);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('swipe right from inprogress moves to done', () => {
    const onUpdate = vi.fn();
    renderBoard('inprogress', onUpdate);
    const card = screen.getByTestId('task-card');
    expect(card.hasAttribute('draggable')).toBe(false);
    swipe(card, 100);
    expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'done' });
  });

  it('swipe left from inprogress moves to todo', () => {
    const onUpdate = vi.fn();
    renderBoard('inprogress', onUpdate);
    const card = screen.getByTestId('task-card');
    expect(card.hasAttribute('draggable')).toBe(false);
    swipe(card, -100);
    expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'todo' });
  });

  it('swipe left from done moves to inprogress', () => {
    const onUpdate = vi.fn();
    renderBoard('done', onUpdate);
    const card = screen.getByTestId('task-card');
    expect(card.hasAttribute('draggable')).toBe(false);
    swipe(card, -100);
    expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'inprogress' });
  });

  it('swipe right from done stays at done', () => {
    const onUpdate = vi.fn();
    renderBoard('done', onUpdate);
    const card = screen.getByTestId('task-card');
    expect(card.hasAttribute('draggable')).toBe(false);
    swipe(card, 100);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('replaces status dropdown with pill and updates text on swipe', async () => {
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
    expect(screen.getByText('To Do')).toBeInTheDocument();
    const card = screen.getByTestId('task-card');
    expect(card.hasAttribute('draggable')).toBe(false);
    fireEvent.touchStart(card, { touches: [{ clientX: 0 }] });
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 100 }] });
    await screen.findByText('In Progress');
  });

  describe('mobile detection fallback', () => {
    beforeAll(() => {
      window.matchMedia = () => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      });
      Object.defineProperty(navigator, 'maxTouchPoints', {
        value: 1,
        configurable: true,
      });
    });

    it('swipes when matchMedia is false but maxTouchPoints > 0', () => {
      const onUpdate = vi.fn();
      renderBoard('todo', onUpdate);
      const card = screen.getByTestId('task-card');
      fireEvent.touchStart(card, { touches: [{ clientX: 0 }] });
      fireEvent.touchEnd(card, { changedTouches: [{ clientX: 100 }] });
      expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'inprogress' });
    });
  });
});
