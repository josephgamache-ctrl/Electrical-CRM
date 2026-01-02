import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  IconButton,
  TextField,
  Button,
  Divider,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Task as TaskIcon,
  Note as NoteIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import {
  getCurrentUser,
  fetchWorkOrderTasks,
  createWorkOrderTask,
  updateWorkOrderTask,
  deleteWorkOrderTask,
  convertScopeToTasks,
  fetchWorkOrderNotes,
  addWorkOrderNote,
  deleteWorkOrderNote,
} from '../api';
import logger from '../utils/logger';

function JobTasks({ workOrderId, workOrder, onError, onSuccess, onTasksConverted }) {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [addingTask, setAddingTask] = useState(false);
  const [taskNoteDialog, setTaskNoteDialog] = useState(null);
  const [taskNote, setTaskNote] = useState('');
  const [converting, setConverting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    loadCurrentUser();
    loadTasks();
    loadNotes();
    // Auto-convert scope if it exists and hasn't been converted yet
    if (workOrder?.scope_of_work && !workOrder?.scope_converted_to_tasks) {
      handleConvertScope(false); // Auto-convert without confirmation
    }
  }, [workOrderId, workOrder]);

  const loadCurrentUser = async () => {
    try {
      const user = await getCurrentUser();
      setCurrentUser(user);
    } catch (err) {
      logger.error('Error loading current user:', err);
    }
  };

  const loadTasks = async () => {
    try {
      setLoading(true);
      const data = await fetchWorkOrderTasks(workOrderId);
      setTasks(data);
    } catch (err) {
      logger.error('Error loading tasks:', err);
      onError?.(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async () => {
    try {
      const data = await fetchWorkOrderNotes(workOrderId);
      // Ensure data is an array
      setNotes(Array.isArray(data.notes) ? data.notes : []);
    } catch (err) {
      logger.error('Error loading notes:', err);
      setNotes([]);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskDescription.trim()) return;

    try {
      setAddingTask(true);
      await createWorkOrderTask(workOrderId, {
        task_description: newTaskDescription,
        task_order: tasks.length,
      });
      setNewTaskDescription('');
      onSuccess?.('Task added successfully');
      await loadTasks();
    } catch (err) {
      logger.error('Error adding task:', err);
      onError?.(err.message);
    } finally {
      setAddingTask(false);
    }
  };

  const handleToggleTask = async (taskId, currentStatus) => {
    try {
      await updateWorkOrderTask(workOrderId, taskId, {
        is_completed: !currentStatus,
      });
      onSuccess?.(currentStatus ? 'Task marked as incomplete' : 'Task completed!');
      await loadTasks();
    } catch (err) {
      logger.error('Error toggling task:', err);
      onError?.(err.message);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;

    try {
      await deleteWorkOrderTask(workOrderId, taskId);
      onSuccess?.('Task deleted');
      await loadTasks();
    } catch (err) {
      logger.error('Error deleting task:', err);
      onError?.(err.message);
    }
  };

  const handleConvertScope = async (showConfirm = true) => {
    if (showConfirm && !window.confirm('Convert scope of work to editable tasks? This will archive the original text.')) return;

    try {
      setConverting(true);
      const data = await convertScopeToTasks(workOrderId);
      if (showConfirm) {
        onSuccess?.(data.message);
      }
      await loadTasks();
      onTasksConverted?.();
    } catch (err) {
      logger.error('Error converting scope:', err);
      if (showConfirm) {
        onError?.(err.message);
      }
    } finally {
      setConverting(false);
    }
  };

  const handleAddTaskNote = async () => {
    if (!taskNote.trim() || !taskNoteDialog) return;

    try {
      // Note: addWorkOrderNote expects note string, but we need task-related note
      // For now keeping task note functionality inline as it has special fields
      await addWorkOrderNote(workOrderId, taskNote);
      setTaskNote('');
      setTaskNoteDialog(null);
      onSuccess?.('Note added to task');
      await loadNotes();
    } catch (err) {
      logger.error('Error adding task note:', err);
      onError?.(err.message);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;

    try {
      await deleteWorkOrderNote(workOrderId, noteId);
      onSuccess?.('Note deleted');
      await loadNotes();
    } catch (err) {
      logger.error('Error deleting note:', err);
      onError?.(err.message);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  const completedCount = tasks.filter(t => t.is_completed).length;
  const totalCount = tasks.length;
  const hasScopeText = workOrder?.scope_of_work && !workOrder?.scope_converted_to_tasks;
  const isAdmin = currentUser?.role === 'admin';

  // Check if a task is from the original scope (created during conversion)
  // We identify these as tasks created before any user-added tasks
  const isAdminCreatedTask = (task) => {
    // If there's an original scope stored, tasks with matching order are admin-created
    // Alternatively, if created_by is null/system, it's from scope conversion
    return !task.created_by || task.created_by === 'system';
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <TaskIcon sx={{ mr: 1, color: '#FF6B00' }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            Scope of Work
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {hasScopeText && (
            <Button
              variant="outlined"
              size="small"
              onClick={handleConvertScope}
              disabled={converting}
              startIcon={converting ? <CircularProgress size={16} /> : <TaskIcon />}
              sx={{ borderColor: '#FF6B00', color: '#FF6B00', '&:hover': { borderColor: '#E55F00', bgcolor: '#FFF3E0' } }}
            >
              {converting ? 'Converting...' : 'Convert to Tasks'}
            </Button>
          )}
          {totalCount > 0 && (
            <Chip
              label={`${completedCount}/${totalCount} Complete`}
              color={completedCount === totalCount ? 'success' : 'default'}
              sx={{ fontWeight: 'bold' }}
            />
          )}
        </Box>
      </Box>

      {/* Add New Task */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Add a new task..."
          value={newTaskDescription}
          onChange={(e) => setNewTaskDescription(e.target.value)}
          variant="outlined"
          size="small"
          onKeyPress={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleAddTask();
            }
          }}
        />
        <Button
          variant="contained"
          onClick={handleAddTask}
          disabled={!newTaskDescription.trim() || addingTask}
          startIcon={addingTask ? <CircularProgress size={16} /> : <AddIcon />}
          sx={{ minWidth: 100, bgcolor: '#FF6B00', '&:hover': { bgcolor: '#E55F00' } }}
        >
          Add
        </Button>
      </Box>

      {/* Tasks List */}
      {tasks.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
          No tasks yet. Add tasks to track the scope of work.
        </Typography>
      ) : (
        <List sx={{ bgcolor: 'background.paper', borderRadius: 1 }}>
          {tasks.map((task, index) => (
            <React.Fragment key={task.id}>
              {index > 0 && <Divider />}
              <ListItem
                sx={{
                  bgcolor: task.is_completed ? '#f5f5f5' : 'transparent',
                  transition: 'background-color 0.3s',
                }}
                secondaryAction={
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    {/* Everyone can add notes */}
                    <IconButton
                      edge="end"
                      size="small"
                      onClick={() => setTaskNoteDialog(task.id)}
                      title="Add note to this task"
                    >
                      <NoteIcon />
                    </IconButton>
                    {/* Only allow deleting admin-created tasks if user is admin */}
                    {(isAdmin || !isAdminCreatedTask(task)) && (
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleDeleteTask(task.id)}
                        title="Delete task"
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </Box>
                }
              >
                <ListItemIcon>
                  <Checkbox
                    edge="start"
                    checked={task.is_completed}
                    onChange={() => handleToggleTask(task.id, task.is_completed)}
                    sx={{
                      color: '#FF6B00',
                      '&.Mui-checked': {
                        color: '#4CAF50',
                      },
                    }}
                  />
                </ListItemIcon>
                <ListItemText
                    primary={
                      <Box>
                        <Typography
                          variant="body1"
                          sx={{
                            textDecoration: task.is_completed ? 'line-through' : 'none',
                            color: task.is_completed ? 'text.secondary' : 'text.primary',
                          }}
                        >
                          {task.task_description}
                        </Typography>
                        {isAdminCreatedTask(task) && !isAdmin && (
                          <Chip
                            label="Original Scope"
                            size="small"
                            sx={{
                              mt: 0.5,
                              bgcolor: '#FFF3E0',
                              color: '#FF6B00',
                              fontSize: '0.7rem',
                              height: 20,
                            }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      task.is_completed && task.completed_by ? (
                        <Typography variant="caption" color="text.secondary">
                          Completed by {task.completed_by} on{' '}
                          {new Date(task.completed_at).toLocaleDateString()} at{' '}
                          {new Date(task.completed_at).toLocaleTimeString()}
                        </Typography>
                      ) : task.created_by ? (
                        <Typography variant="caption" color="text.secondary">
                          Created by {task.created_by}
                        </Typography>
                      ) : (
                        <Typography variant="caption" color="text.secondary">
                          From original scope of work
                        </Typography>
                      )
                    }
                  />
              </ListItem>
              {/* Display notes for this task */}
              {Array.isArray(notes) && notes
                .filter(note => note.related_task_id === task.id)
                .map((note) => (
                  <Box
                    key={note.id}
                    sx={{
                      ml: 8,
                      mr: 2,
                      mb: 1,
                      p: 1.5,
                      bgcolor: '#FFF9E6',
                      borderLeft: '3px solid #FF6B00',
                      borderRadius: 1,
                      position: 'relative',
                    }}
                  >
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteNote(note.id)}
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        padding: '4px',
                        '&:hover': {
                          bgcolor: 'rgba(255, 107, 0, 0.1)',
                        },
                      }}
                      title="Delete note"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="body2" sx={{ mb: 0.5, pr: 4 }}>
                      {note.note_text}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Note by {note.created_by} on {new Date(note.created_at).toLocaleDateString()} at {new Date(note.created_at).toLocaleTimeString()}
                    </Typography>
                  </Box>
                ))}
            </React.Fragment>
          ))}
        </List>
      )}

      {/* Task Note Dialog */}
      <Dialog open={!!taskNoteDialog} onClose={() => setTaskNoteDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Note to Task</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            multiline
            rows={3}
            placeholder="Add a note about this task..."
            value={taskNote}
            onChange={(e) => setTaskNote(e.target.value)}
            variant="outlined"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTaskNoteDialog(null)}>Cancel</Button>
          <Button
            onClick={handleAddTaskNote}
            variant="contained"
            disabled={!taskNote.trim()}
            sx={{ bgcolor: '#FF6B00', '&:hover': { bgcolor: '#E55F00' } }}
          >
            Add Note
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default JobTasks;
