import { render, fireEvent } from '@testing-library/react';
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
    const { container } = renderBoard('todo', onUpdate);
    const card = container.querySelector('[draggable="true"]');
    swipe(card, 100);
    expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'inprogress' });
  });

  it('swipe left from todo stays at todo', () => {
    const onUpdate = vi.fn();
    const { container } = renderBoard('todo', onUpdate);
    const card = container.querySelector('[draggable="true"]');
    swipe(card, -100);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('swipe right from inprogress moves to done', () => {
    const onUpdate = vi.fn();
    const { container } = renderBoard('inprogress', onUpdate);
    const card = container.querySelector('[draggable="true"]');
    swipe(card, 100);
    expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'done' });
  });

  it('swipe left from inprogress moves to todo', () => {
    const onUpdate = vi.fn();
    const { container } = renderBoard('inprogress', onUpdate);
    const card = container.querySelector('[draggable="true"]');
    swipe(card, -100);
    expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'todo' });
  });

  it('swipe left from done moves to inprogress', () => {
    const onUpdate = vi.fn();
    const { container } = renderBoard('done', onUpdate);
    const card = container.querySelector('[draggable="true"]');
    swipe(card, -100);
    expect(onUpdate).toHaveBeenCalledWith('t1', { status: 'inprogress' });
  });

  it('swipe right from done stays at done', () => {
    const onUpdate = vi.fn();
    const { container } = renderBoard('done', onUpdate);
    const card = container.querySelector('[draggable="true"]');
    swipe(card, 100);
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
