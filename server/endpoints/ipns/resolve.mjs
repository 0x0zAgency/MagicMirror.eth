import server from '../../server.mjs';
import { userError } from '../../utils/helpers.mjs';

/**
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export const post = async (req, res) => {
  let name = req.body.path;

  if (!name.includes('/ipns/')) name = '/ipns/' + name;

  if (!name) {
    return res.status(400).send({
      error: 'Missing name',
    });
  }

  const result = await server.ipfs.name.resolve(name, {
    timeout: 2000,
  });

  let path;
  for await (const name of result) {
    path = name;
  }

  if (path === undefined)
    return userError(res, 'eth address has bad IPNS resolution');

  res.json({
    cid: path,
  });
};
