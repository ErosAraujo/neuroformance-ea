import { Router } from 'express';
import { StudentsController } from '../controllers/StudentsController';

const router = Router();

router.get('/', StudentsController.list);
router.get('/:id', StudentsController.detail);

// Arquiva um aluno (status = archived)
router.patch('/:id/archive', StudentsController.archive);
// Restaura um aluno (status = active)
router.patch('/:id/restore', StudentsController.restore);
// Deleta logicamente um aluno (status = deleted)
router.delete('/:id', StudentsController.delete);

export default router;