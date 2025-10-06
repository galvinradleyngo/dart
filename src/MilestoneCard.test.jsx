import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import MilestoneCard from './MilestoneCard.jsx';
import { CoursePMApp } from './App.jsx';

const milestone = { id: 'm1', title: 'Milestone 1', goal: '', start: '' };

const readCardTitles = () =>
  screen
    .getAllByTestId('task-card')
    .map((card) => within(card).getByTitle('Click to edit').textContent);

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

  it('colors progress bar based on completion', () => {
    const tasks = [
      { id: 't1', status: 'done' },
      { id: 't2', status: 'todo' },
    ];
    render(<MilestoneCard milestone={milestone} tasks={tasks} />);
    const pct = 50;
    const color = `hsl(${210 + (pct / 100) * (140 - 210)}, 70%, 50%)`;
    const bar = screen.getByTestId('progress-fill');
    expect(bar.getAttribute('style')).toContain(`background-color: ${color}`);
  });

  it('adds tasks from the collapsed summary button', () => {
    const onAddTask = vi.fn();
    const { container } = render(
      <MilestoneCard milestone={milestone} onAddTask={onAddTask} />,
    );

    const addButton = screen.getByLabelText(/add task/i);
    fireEvent.click(addButton);

    expect(onAddTask).toHaveBeenCalledWith('m1');
    const details = container.querySelector('details');
    expect(details?.open).toBe(true);
  });

  it('saves a milestone into the course when requested', () => {
    const onSaveMilestone = vi.fn();
    render(
      <MilestoneCard
        milestone={milestone}
        onSaveMilestone={onSaveMilestone}
      />,
    );

    const saveButton = screen.getByLabelText('Save milestone to course');
    fireEvent.click(saveButton);

    expect(onSaveMilestone).toHaveBeenCalledWith('m1');
  });

  it('saves a milestone as a reusable template', () => {
    const onSaveAsTemplate = vi.fn();
    render(
      <MilestoneCard
        milestone={milestone}
        onSaveAsTemplate={onSaveAsTemplate}
      />,
    );

    const templateButton = screen.getByLabelText('Save as milestone template');
    fireEvent.click(templateButton);

    expect(onSaveAsTemplate).toHaveBeenCalledWith('m1');
  });

  it('sorts tasks by numeric order by default', () => {
    const tasks = [
      { id: 't1', title: 'First task', status: 'todo', order: 1 },
      { id: 't2', title: 'Zeroth task', status: 'todo', order: 0 },
      { id: 't3', title: 'Second task', status: 'todo', order: 2 },
    ];

    render(<MilestoneCard milestone={milestone} tasks={tasks} tasksAll={tasks} />);

    const titles = screen
      .getAllByTestId('task-card')
      .map((card) => within(card).getByTitle('Click to edit').textContent);

    expect(titles).toEqual(['Zeroth task', 'First task', 'Second task']);
  });

  it('sorts tasks alphabetically when requested', () => {
    const tasks = [
      { id: 't1', title: 'zeta', status: 'todo', order: 0 },
      { id: 't2', title: 'Alpha', status: 'todo', order: 1 },
      { id: 't3', title: 'beta', status: 'todo', order: 2 },
    ];

    render(
      <MilestoneCard milestone={milestone} tasks={tasks} tasksAll={tasks} taskSort="title" />,
    );

    const titles = screen
      .getAllByTestId('task-card')
      .map((card) => within(card).getByTitle('Click to edit').textContent);

    expect(titles).toEqual(['Alpha', 'beta', 'zeta']);
  });

  it('sorts tasks by status when requested', () => {
    const tasks = [
      { id: 't1', title: 'Done task', status: 'done', order: 0 },
      { id: 't2', title: 'Todo task', status: 'todo', order: 2 },
      { id: 't3', title: 'Blocked task', status: 'blocked', order: 1 },
      { id: 't4', title: 'In progress task', status: 'inprogress', order: 3 },
      { id: 't5', title: 'Skipped task', status: 'skip', order: 4 },
    ];

    render(
      <MilestoneCard
        milestone={milestone}
        tasks={tasks}
        tasksAll={tasks}
        taskSort="status"
      />,
    );

    const titles = screen
      .getAllByTestId('task-card')
      .map((card) => within(card).getByTitle('Click to edit').textContent);

    expect(titles).toEqual([
      'Todo task',
      'In progress task',
      'Blocked task',
      'Done task',
      'Skipped task',
    ]);
  });

  it('sorts tasks by deadline recency when requested', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2024-05-10T00:00:00Z'));

      const tasks = [
        { id: 't1', title: 'No due date', status: 'todo', order: 0, dueDate: '' },
        { id: 't2', title: 'Due soon', status: 'todo', order: 1, dueDate: '2024-05-11' },
        { id: 't3', title: 'Due today', status: 'todo', order: 2, dueDate: '2024-05-10' },
        { id: 't4', title: 'Due earlier', status: 'todo', order: 3, dueDate: '2024-05-08' },
      ];

      render(
        <MilestoneCard milestone={milestone} tasks={tasks} tasksAll={tasks} taskSort="deadline" />,
      );

      const titles = screen
        .getAllByTestId('task-card')
        .map((card) => within(card).getByTitle('Click to edit').textContent);

      expect(titles).toEqual(['Due today', 'Due earlier', 'Due soon', 'No due date']);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('CoursePMApp milestone task sorting', () => {
  it('updates milestone task ordering when selecting different sort modes', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2024-05-10T00:00:00Z'));

      const boot = {
        course: { id: 'course-1', name: 'Course 1' },
        team: [],
        milestones: [
          { id: 'm1', title: 'Alpha Milestone', goal: '' },
        ],
        tasks: [
          { id: 't1', title: 'Gamma task', status: 'todo', order: 2, milestoneId: 'm1', dueDate: '2024-05-11' },
          { id: 't2', title: 'beta task', status: 'inprogress', order: 1, milestoneId: 'm1', dueDate: '2024-05-09' },
          { id: 't3', title: 'Alpha task', status: 'blocked', order: 0, milestoneId: 'm1', dueDate: '' },
        ],
        linkLibrary: [],
        schedule: { workweek: [1, 2, 3, 4, 5], holidays: [] },
      };

      render(
        <CoursePMApp
          boot={boot}
          isTemplateLabel={false}
          onBack={() => {}}
          onStateChange={() => {}}
          people={[]}
          milestoneTemplates={[]}
          onChangeMilestoneTemplates={() => {}}
          onOpenUser={() => {}}
        />,
      );

      const readTaskTitles = () =>
        screen
          .getAllByTestId('task-card')
          .map((card) => within(card).getByTitle('Click to edit').textContent);

      expect(readTaskTitles()).toEqual(['Alpha task', 'beta task', 'Gamma task']);

      const select = screen.getByLabelText('Sort tasks within milestones');

      fireEvent.change(select, { target: { value: 'title' } });
      expect(readTaskTitles()).toEqual(['Alpha task', 'beta task', 'Gamma task']);

      fireEvent.change(select, { target: { value: 'status' } });
      expect(readTaskTitles()).toEqual(['Gamma task', 'beta task', 'Alpha task']);

      fireEvent.change(select, { target: { value: 'deadline' } });
      expect(readTaskTitles()).toEqual(['beta task', 'Gamma task', 'Alpha task']);
    } finally {
      vi.useRealTimers();
    }
  });
});

