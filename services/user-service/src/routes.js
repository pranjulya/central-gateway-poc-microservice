import { Router } from 'express';
import createError from 'http-errors';
import * as store from './store.js';

const router = Router();

router.get('/users', (req, res) => {
  res.json({
    data: store.list(),
    requestId: req.requestId,
  });
});

router.get('/users/:id', (req, res, next) => {
  const user = store.get(req.params.id);
  if (!user) {
    next(createError(404, 'User not found'));
    return;
  }
  res.json({
    data: user,
    requestId: req.requestId,
  });
});

router.post('/users', (req, res, next) => {
  const { name, email } = req.body || {};
  if (!name || !email) {
    next(createError(400, 'name and email are required'));
    return;
  }

  const user = store.create({ name, email });
  res.status(201)
    .location(`/users/${user.id}`)
    .json({
      data: user,
      requestId: req.requestId,
    });
});

router.delete('/users/:id', (req, res, next) => {
  const removed = store.remove(req.params.id);
  if (!removed) {
    next(createError(404, 'User not found'));
    return;
  }
  res.status(204).send();
});

export default router;
