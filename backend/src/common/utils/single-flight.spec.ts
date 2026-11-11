import { KeyedSingleFlight } from './single-flight';

describe('KeyedSingleFlight', () => {
  it('chamadas simultâneas da mesma chave rodam a tarefa uma vez só', async () => {
    const flight = new KeyedSingleFlight<number>();
    let runs = 0;
    const task = async () => {
      runs++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return runs;
    };

    const results = await Promise.all([flight.run('u1', task), flight.run('u1', task), flight.run('u1', task)]);

    expect(runs).toBe(1);
    expect(results).toEqual([1, 1, 1]);
  });

  it('chaves diferentes não esperam uma pela outra', async () => {
    const flight = new KeyedSingleFlight<string>();
    const task = jest.fn(async () => 'ok');

    await Promise.all([flight.run('u1', task), flight.run('u2', task)]);

    expect(task).toHaveBeenCalledTimes(2);
  });

  it('depois de terminar (ou falhar), a próxima chamada roda de novo', async () => {
    const flight = new KeyedSingleFlight<string>();
    const task = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue('ok');

    await expect(flight.run('u1', task)).rejects.toThrow('boom');
    await expect(flight.run('u1', task)).resolves.toBe('ok');
    await expect(flight.run('u1', task)).resolves.toBe('ok');
    expect(task).toHaveBeenCalledTimes(3);
  });
});
