export * from './component';

export const getLayout = async () => {
  let response = await import('./layout.json')
  return response.default;
}
