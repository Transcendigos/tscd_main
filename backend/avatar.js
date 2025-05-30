import fp from 'fastify-plugin';
import fs from 'fs';
import path from 'path';

export default fp(async function (fastify, opts) {
  const avatarDir = path.join(process.cwd(), 'backend', 'uploads', 'avatars');
  fs.mkdirSync(avatarDir, { recursive: true });

  fastify.post('/api/users/avatar', async (request, reply) => {
    const { avatar } = request.body;

    if (!avatar || !avatar.startsWith("data:image/png;base64,")) {
      return reply.status(400).send({ error: "Format d'image invalide" });
    }

    const base64Data = avatar.replace(/^data:image\/png;base64,/, "");
    const userId = 42; // À remplacer par un vrai ID utilisateur

    const filePath = path.join(avatarDir, `${userId}.png`);
    try {
      fs.writeFileSync(filePath, base64Data, "base64");
      return { message: "Avatar enregistré", file: `/uploads/avatars/${userId}.png` };
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({ error: "Erreur serveur" });
    }
  });

  // Statique : pour servir les fichiers d’avatar
  fastify.register(import('@fastify/static'), {
    root: path.join(process.cwd(), 'backend', 'uploads'),
    prefix: '/uploads/',
  });
});
