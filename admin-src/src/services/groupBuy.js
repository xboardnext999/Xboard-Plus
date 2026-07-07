import { request, toQuery } from './http';

export function fetchGroupBuyActivities(params) {
  const query = toQuery(params);
  return request(`/group-buy/fetch${query ? `?${query}` : ''}`);
}

export function saveGroupBuyActivity(payload) {
  return request('/group-buy/save', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateGroupBuyActivity(payload) {
  return request('/group-buy/update', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function dropGroupBuyActivity(id) {
  return request('/group-buy/drop', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export function fetchGroupBuyGroups(params) {
  const query = toQuery(params);
  return request(`/group-buy/groups${query ? `?${query}` : ''}`);
}
