(function () {
  'use strict';

  var root, state, storageKey;
  var nextId = 1;
  function id() { return String(Date.now()) + '-' + String(nextId++); }
  var SITES = [
    { id: 'f1', label: 'Fortress No. 1', amount: 60 },
    { id: 'f2', label: 'Fortress No. 2', amount: 200 },
    { id: 'f3', label: 'Fortress No. 3', amount: 90 },
    { id: 'f4', label: 'Fortress No. 4', amount: 400, specialName: '1h Speedups', specialCap: 10 },
    { id: 'f5', label: 'Fortress No. 5', amount: 60 },
    { id: 'f6', label: 'Fortress No. 6', amount: 200 },
    { id: 'f7', label: 'Fortress No. 7', amount: 90 },
    { id: 'f8', label: 'Fortress No. 8', amount: 400, specialName: '1h Speedups', specialCap: 10 },
    { id: 'f9', label: 'Fortress No. 9', amount: 60 },
    { id: 'f10', label: 'Fortress No. 10', amount: 200 },
    { id: 'f11', label: 'Fortress No. 11', amount: 90 },
    { id: 'f12', label: 'Fortress No. 12', amount: 400, specialName: '1h Speedups', specialCap: 10 },
    { id: 's1', label: 'Stronghold No. 1', amount: 100, specialName: 'Pet Chests', specialCap: 3 },
    { id: 's2', label: 'Stronghold No. 2', amount: 420 },
    { id: 's3', label: 'Stronghold No. 3', amount: 600 },
    { id: 's4', label: 'Stronghold No. 4', amount: 150 }
  ];
  var LEADERS = [
    { name: 'Jim Lahey', role: 'r5' },
    { name: 'Lord Solo', role: 'r4' },
    { name: 'ADRIAN', role: 'r4' },
    { name: 'xxLUNAxx', role: 'r4' },
    { name: 'SkyMnky', role: 'r4' },
    { name: 'Talie', role: 'r4' },
    { name: 'RiMa', role: 'r4' },
    { name: 'PinkTaco', role: 'r4' },
    { name: 'MayBJulian', role: 'r4' },
    { name: 'Chlebooo69', role: 'r4' },
    { name: 'icardifox', role: 'r4' },
    { name: 'Ricky Lahey', role: 'r4', excluded: true }
  ];
  function empty() { return { members: [], rewards: [], sites: [], allocation: {}, leadersSeeded: false, rosterVersion: 0 }; }
  function seedLeaders() {
    if (state.leadersSeeded) return;
    LEADERS.forEach(function (leader) {
      var member = state.members.find(function (m) { return m.name.toLowerCase() === leader.name.toLowerCase(); });
      if (member) { member.role = leader.role; member.excluded = !!leader.excluded; }
      else state.members.push({ id: id(), name: leader.name, role: leader.role, excluded: !!leader.excluded });
    });
    state.leadersSeeded = true;
    save();
  }
  function seedRoster() {
    if (state.rosterVersion === 1 || !Array.isArray(window.FOXFortressRoster)) return;
    window.FOXFortressRoster.forEach(function (row) {
      var member = state.members.find(function (m) { return m.name.toLowerCase() === row[1].toLowerCase(); });
      if (!member) {
        member = { id: id(), name: row[1], contribution: 1, excluded: false };
        state.members.push(member);
      }
      member.rank = row[0];
      member.role = row[2];
      member.power = row[3];
      if (row[1] === 'Ricky Lahey') member.excluded = true;
    });
    state.members.sort(function (a, b) { return (a.rank || 999) - (b.rank || 999); });
    state.rosterVersion = 1;
    save();
  }
  function applyKnownRewardLimits() {
    if (state.rewardPresetsVersion === 1) return;
    state.rewards.forEach(function (reward) {
      var site = SITES.find(function (item) {
        return reward.id === item.id + '-chests' || reward.id === item.id + '-special';
      });
      if (!site) return;
      if (reward.id === site.id + '-chests' && !integer(reward.cap)) reward.cap = site.id.charAt(0) === 'f' ? 1 : 2;
      if (reward.id === site.id + '-special') {
        if (site.specialCap && !integer(reward.cap)) reward.cap = site.specialCap;
        if (site.specialName && reward.name === site.label + ' special reward') reward.name = site.label + ' ' + site.specialName;
      }
    });
    state.rewardPresetsVersion = 1;
    save();
  }
  function includedMembers() { return state.members.filter(function (member) { return !member.excluded; }); }
  function alphabeticalMembers() {
    return includedMembers().sort(function (a, b) {
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
    });
  }
  function fullMembers() { return includedMembers().filter(function (member) { return member.role === 'r4' || member.role === 'r5'; }); }
  function integer(value) {
    var n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(100000, Math.floor(n))) : 0;
  }
  function contribution(member) {
    var n = Number(member.contribution);
    return Number.isFinite(n) && n >= 1 ? Math.min(4, Math.floor(n)) : 1;
  }
  function powerNumber(value) {
    var n = Number(value);
    return Number.isFinite(n) ? Math.max(0, Math.min(1000000000000, Math.floor(n))) : 0;
  }
  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function load() {
    try {
      var saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && Array.isArray(saved.members) && Array.isArray(saved.rewards)) {
        state = saved;
        state.sites = Array.isArray(state.sites) ? state.sites : [];
        state.allocation = state.allocation || {};
        seedLeaders();
        seedRoster();
        applyKnownRewardLimits();
        return;
      }
    } catch (e) { /* Start with an empty draft if browser storage is unavailable. */ }
    state = empty();
    seedLeaders();
    seedRoster();
    applyKnownRewardLimits();
  }
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (e) { /* Export remains available. */ }
  }
  function assigned(reward, member) {
    if (member.excluded) return 0;
    return integer((state.allocation[reward.id] || {})[member.id]);
  }
  function setAssigned(reward, member, count) {
    if (!state.allocation[reward.id]) state.allocation[reward.id] = {};
    state.allocation[reward.id][member.id] = integer(count);
  }
  function rewardTotal(reward) {
    return includedMembers().reduce(function (sum, member) { return sum + assigned(reward, member); }, 0);
  }
  function memberTotal(member) {
    return state.rewards.reduce(function (sum, reward) { return sum + assigned(reward, member); }, 0);
  }
  function stats() {
    var available = 0, allocated = 0, issues = [];
    state.rewards.forEach(function (reward) {
      var quantity = integer(reward.quantity), total = rewardTotal(reward), cap = integer(reward.cap);
      available += quantity;
      allocated += total;
      if (total > quantity) issues.push(reward.name + ': ' + (total - quantity) + ' above available quantity.');
      includedMembers().forEach(function (member) {
        if (cap && assigned(reward, member) > cap)
          issues.push(member.name + ' / ' + reward.name + ': above per-player limit.');
      });
      if (fullMembers().length) {
        if (!cap) issues.push(reward.name + ': set the per-player maximum for R4/R5.');
        else if (fullMembers().length * cap > quantity)
          issues.push(reward.name + ': not enough rewards to give every R4/R5 the maximum.');
        else {
          var missing = fullMembers().filter(function (member) { return assigned(reward, member) !== cap; }).length;
          if (missing) issues.push(reward.name + ': ' + missing + ' R4/R5 members are not at the maximum.');
        }
      }
    });
    return { available: available, allocated: allocated, issues: issues };
  }
  function propose() {
    if (state.rewards.some(function (reward) { return integer(reward.quantity) > 5000; })) {
      message('Automatic proposals support up to 5,000 units per reward pool.');
      return;
    }
    var leaders = fullMembers();
    var impossible = state.rewards.find(function (reward) {
      return leaders.length && (!integer(reward.cap) || leaders.length * integer(reward.cap) > integer(reward.quantity));
    });
    if (impossible) {
      message(impossible.name + ': enter a per-player limit and enough rewards for every R4/R5.');
      return;
    }
    var awarded = {};
    includedMembers().forEach(function (member) { awarded[member.id] = 0; });
    state.allocation = {};
    state.rewards.forEach(function (reward) {
      var quantity = integer(reward.quantity), cap = integer(reward.cap);
      leaders.forEach(function (member) { setAssigned(reward, member, cap); awarded[member.id] += cap; });
      for (var unit = leaders.length * cap; unit < quantity; unit++) {
        var candidates = includedMembers().filter(function (member) {
          return !cap || assigned(reward, member) < cap;
        });
        if (!candidates.length) break;
        candidates.sort(function (a, b) {
          return (assigned(reward, a) + 1) / contribution(a) - (assigned(reward, b) + 1) / contribution(b) ||
            (awarded[a.id] + 1) / contribution(a) - (awarded[b.id] + 1) / contribution(b) ||
            state.members.indexOf(a) - state.members.indexOf(b);
        });
        setAssigned(reward, candidates[0], assigned(reward, candidates[0]) + 1);
        awarded[candidates[0].id]++;
      }
    });
    save();
    render();
  }
  function roleOptions(member) {
    return ['r1', 'r2', 'r3', 'r4', 'r5'].map(function (role) {
      return '<option value="' + role + '"' + (member.role === role ? ' selected' : '') + '>' + role.toUpperCase() + '</option>';
    }).join('');
  }
  function contributionOptions(member) {
    return [1, 2, 3, 4].map(function (value) {
      return '<option value="' + value + '"' + (contribution(member) === value ? ' selected' : '') + '>' + value + '</option>';
    }).join('');
  }
  function render() {
    if (!root) return;
    var oldSearch = root.querySelector('#fr-member-search');
    var searchText = oldSearch ? oldSearch.value : '';
    var oldList = root.querySelector('.fr-members-scroll');
    var listScroll = oldList ? oldList.scrollTop : 0;
    var s = stats();
    var memberRows = state.members.slice().sort(function (a, b) {
      var aGroup = a.role === 'r5' ? 0 : a.role === 'r4' ? 1 : 2;
      var bGroup = b.role === 'r5' ? 0 : b.role === 'r4' ? 1 : 2;
      return aGroup - bGroup || state.members.indexOf(a) - state.members.indexOf(b);
    }).map(function (member) {
      return '<tr data-member-name="' + escapeHTML(member.name.toLowerCase()) + '" class="' + (member.excluded ? 'fr-ignored' : '') + '"><th scope="row"><div class="fr-member-name"><input type="text" maxlength="60" value="' + escapeHTML(member.name) + '" data-member="' + member.id + '" data-field="name" aria-label="Member name"><button type="button" class="fr-remove" data-remove-member="' + member.id + '" aria-label="Remove ' + escapeHTML(member.name) + '">×</button></div></th>' +
        '<td><input type="checkbox" data-member="' + member.id + '" data-field="excluded" aria-label="Exclude ' + escapeHTML(member.name) + ' from calculations"' + (member.excluded ? ' checked' : '') + '></td>' +
        '<td><select data-member="' + member.id + '" data-field="role" aria-label="Role for ' + escapeHTML(member.name) + '">' + roleOptions(member) + '</select></td>' +
        '<td>' + (member.role === 'r4' || member.role === 'r5' ? '—' : '<select data-member="' + member.id + '" data-field="contribution" aria-label="Contribution for ' + escapeHTML(member.name) + '">' + contributionOptions(member) + '</select>') + '</td></tr>';
    }).join('');
    var rewardRows = state.rewards.map(function (reward) {
      var total = rewardTotal(reward), quantity = integer(reward.quantity);
      return '<tr><th scope="row"><input type="text" maxlength="80" value="' + escapeHTML(reward.name) + '" data-reward="' + reward.id + '" data-field="name" aria-label="Reward name"></th>' +
        '<td><input type="number" min="0" max="100000" value="' + quantity + '" data-reward="' + reward.id + '" data-field="quantity" aria-label="Available quantity for ' + escapeHTML(reward.name) + '"></td>' +
        '<td><input type="number" min="0" max="100000" value="' + integer(reward.cap) + '" data-reward="' + reward.id + '" data-field="cap" aria-label="Per-player limit for ' + escapeHTML(reward.name) + '"></td>' +
        '<td class="' + (total > quantity ? 'fr-bad' : '') + '"><strong>' + total + ' / ' + quantity + '</strong></td>' +
        '<td>' + (SITES.some(function (site) { return reward.id === site.id + '-chests' || reward.id === site.id + '-special'; }) ? '' : '<button type="button" class="fr-remove" data-remove-reward="' + reward.id + '" aria-label="Remove ' + escapeHTML(reward.name) + '">×</button>') + '</td></tr>';
    }).join('');
    var activeReward = state.rewards.find(function (reward) { return reward.id === state.activeRewardId; }) || state.rewards[0];
    if (activeReward) state.activeRewardId = activeReward.id;
    var rewardPicker = activeReward ? '<label>Reward to edit<select id="fr-active-reward">' + state.rewards.map(function (reward) {
      return '<option value="' + reward.id + '"' + (reward.id === activeReward.id ? ' selected' : '') + '>' + escapeHTML(reward.name) + '</option>';
    }).join('') + '</select></label>' : '';
    var allocationRows = activeReward ? '<div class="fr-alloc-card"><h4>' + escapeHTML(activeReward.name) + '<span>' + rewardTotal(activeReward) + ' / ' + integer(activeReward.quantity) + '</span></h4>' +
      (includedMembers().length ? '<div class="fr-alloc-grid">' + alphabeticalMembers().map(function (member) {
        var value = assigned(activeReward, member), over = integer(activeReward.cap) && value > integer(activeReward.cap);
        return '<label class="' + (over ? 'fr-bad' : '') + '"><span>' + escapeHTML(member.name) + ((member.role === 'r4' || member.role === 'r5') ? ' <em>' + member.role.toUpperCase() + '</em>' : '') + '</span><input type="number" min="0" max="100000" value="' + value + '" data-cell-reward="' + activeReward.id + '" data-cell-member="' + member.id + '" aria-label="' + escapeHTML(activeReward.name + ' for ' + member.name) + '"></label>';
      }).join('') + '</div>' : '<p class="fr-empty">Add members to assign rewards.</p>') + '</div>' : '';
    var siteCards = SITES.map(function (site) {
      var selected = state.sites.indexOf(site.id) >= 0;
      var chests = site.id.charAt(0) === 'f' ? 40 : 100;
      return '<label class="fr-site' + (selected ? ' selected' : '') + '"><input type="checkbox" data-site="' + site.id + '"' + (selected ? ' checked' : '') + '><span><strong>' + site.label + '</strong><small>' + chests + ' chests + ' + site.amount + ' ' + (site.specialName || 'special rewards') + '</small></span></label>';
    }).join('');
    root.innerHTML = '<div class="fr-head"><div><h2>Fortress rewards</h2><p>Prepare an alliance distribution, then copy it for R4/R5 assignment in game.</p></div><span class="fr-local">Saved in this browser</span></div>' +
      '<div class="fr-layout"><div class="fr-main">' +
      '<section class="fr-card"><div class="fr-card-head"><h3>Current sites</h3><span>' + state.sites.length + ' selected</span></div><p>Select only the fortresses and strongholds your alliance currently controls. Their chests and special rewards are added below.</p><div class="fr-sites">' + siteCards + '</div><p class="fr-note">Special reward names can be edited in the reward pools.</p></section>' +
      '<section class="fr-card"><div class="fr-card-head"><h3>1. Members</h3><span>' + state.members.length + '</span></div><p>R4/R5 receive the per-player maximum. Excluded members, including Ricky Lahey, are ignored. Paste one additional name per line.</p>' +
      '<div class="fr-add"><textarea id="fr-names" rows="3" placeholder="One member per line" aria-label="Member names"></textarea><button type="button" class="fr-primary" data-action="add-members">Add members</button></div>' +
      (state.members.length ? '<input id="fr-member-search" type="search" placeholder="Find member" aria-label="Find member"><div class="fr-scroll fr-members-scroll"><table><thead><tr><th>Member</th><th>Exclude</th><th>Role</th><th>Contribution</th></tr></thead><tbody>' + memberRows + '</tbody></table></div>' : '<p class="fr-empty">No members yet.</p>') +
      '<p class="fr-note">Contribution rates each R1–R3 member’s engagement from 1 to 4. R4/R5 do not need a rating.</p></section>' +
      '<section class="fr-card"><div class="fr-card-head"><h3>2. Reward pools</h3><span>' + state.rewards.length + '</span></div><p>Enter the in-game per-player maximum for each pool before generating a full R4/R5 allocation.</p>' +
      '<div class="fr-add fr-add-reward"><input id="fr-reward-name" type="text" maxlength="80" placeholder="Reward name" aria-label="Reward name"><input id="fr-reward-quantity" type="number" min="1" max="100000" value="1" aria-label="Available quantity"><input id="fr-reward-cap" type="number" min="0" max="100000" value="0" aria-label="Per-player limit"><button type="button" class="fr-primary" data-action="add-reward">Add reward</button></div>' +
      (state.rewards.length ? '<div class="fr-scroll"><table><thead><tr><th>Reward</th><th>Available</th><th>Limit / player</th><th>Assigned</th><th></th></tr></thead><tbody>' + rewardRows + '</tbody></table></div>' : '<p class="fr-empty">No reward pools yet.</p>') + '</section>' +
      '<section class="fr-card"><div class="fr-card-head"><h3>3. Distribution</h3></div><div class="fr-controls">' + rewardPicker + '<button type="button" class="fr-primary" data-action="propose"' + (!includedMembers().length || !state.rewards.length ? ' disabled' : '') + '>Distribute by contribution</button></div>' +
      '<p class="fr-note">R4/R5 receive their per-player maximum first. Remaining rewards are weighted by each member’s contribution, within the per-player limits. This replaces current allocations; you can edit the numbers below.</p>' +
      (allocationRows || '<p class="fr-empty">Add members and reward pools to start.</p>') + '</section></div>' +
      '<aside class="fr-card fr-summary"><h3>Distribution summary</h3><div class="fr-numbers"><div><strong>' + s.allocated + '</strong><span>Assigned</span></div><div><strong>' + Math.max(0, s.available - s.allocated) + '</strong><span>Remaining</span></div></div>' +
      (s.issues.length ? '<div class="fr-issues" role="alert"><strong>Check allocations</strong><ul>' + s.issues.map(function (issue) { return '<li>' + escapeHTML(issue) + '</li>'; }).join('') + '</ul></div>' : '<p class="fr-ok">No limits exceeded.</p>') +
      '<button type="button" class="fr-primary" data-action="copy"' + (!state.rewards.length || !includedMembers().length || s.issues.length ? ' disabled' : '') + '>Copy distribution</button><button type="button" class="fr-secondary" data-action="csv"' + (!state.rewards.length || !includedMembers().length || s.issues.length ? ' disabled' : '') + '>Download CSV</button><p id="fr-message" role="status" aria-live="polite"></p><p class="fr-note">This draft stays in your browser. It does not send rewards in game.</p></aside></div>';
    var newSearch = root.querySelector('#fr-member-search');
    if (newSearch) { newSearch.value = searchText; onInput({ target: newSearch }); }
    var newList = root.querySelector('.fr-members-scroll');
    if (newList) newList.scrollTop = listScroll;
  }
  function exportRows() {
    var rows = [];
    state.rewards.forEach(function (reward) {
      includedMembers().forEach(function (member) {
        var count = assigned(reward, member);
        if (count) rows.push({ rewardId: reward.id, reward: reward.name, member: member.name, count: count });
      });
    });
    return rows;
  }
  function message(value) { var el = root.querySelector('#fr-message'); if (el) el.textContent = value; }
  function onInput(event) {
    if (event.target.id !== 'fr-member-search') return;
    var query = event.target.value.trim().toLowerCase();
    root.querySelectorAll('tr[data-member-name]').forEach(function (row) {
      row.hidden = row.dataset.memberName.indexOf(query) < 0;
    });
  }
  function onClick(event) {
    var button = event.target.closest('button');
    if (!button || !root.contains(button)) return;
    if (button.dataset.removeMember) {
      var memberId = button.dataset.removeMember;
      state.members = state.members.filter(function (m) { return m.id !== memberId; });
      Object.keys(state.allocation).forEach(function (key) { delete state.allocation[key][memberId]; });
    } else if (button.dataset.removeReward) {
      state.rewards = state.rewards.filter(function (r) { return r.id !== button.dataset.removeReward; });
      delete state.allocation[button.dataset.removeReward];
    } else if (button.dataset.action === 'add-members') {
      var raw = root.querySelector('#fr-names').value;
      raw.split(/\r?\n/).map(function (name) { return name.trim().slice(0, 60); }).filter(Boolean).forEach(function (name) {
        if (!state.members.some(function (m) { return m.name.toLowerCase() === name.toLowerCase(); }))
          state.members.push({ id: id(), name: name, role: 'r3', power: 0, contribution: 1, excluded: false });
      });
    } else if (button.dataset.action === 'add-reward') {
      var name = root.querySelector('#fr-reward-name').value.trim().slice(0, 80);
      if (!name) { root.querySelector('#fr-reward-name').focus(); return; }
      state.rewards.push({ id: id(), name: name, quantity: Math.max(1, integer(root.querySelector('#fr-reward-quantity').value)), cap: integer(root.querySelector('#fr-reward-cap').value) });
    } else if (button.dataset.action === 'propose') {
      propose();
      return;
    } else if (button.dataset.action === 'copy' || button.dataset.action === 'csv') {
      if (stats().issues.length) return;
      var rows = exportRows();
      if (button.dataset.action === 'copy') {
        var lines = ['Fortress rewards distribution'];
        state.rewards.forEach(function (reward) {
          lines.push('', reward.name + ' (' + rewardTotal(reward) + '/' + integer(reward.quantity) + ')');
          rows.filter(function (r) { return r.rewardId === reward.id; }).forEach(function (r) { lines.push(r.member + ' — ' + r.count); });
        });
        if (navigator.clipboard && navigator.clipboard.writeText)
          navigator.clipboard.writeText(lines.join('\n')).then(function () { message('Distribution copied.'); }, function () { message('Copy failed. Use Download CSV.'); });
        else message('Clipboard unavailable. Use Download CSV.');
      } else {
        var csv = 'Reward,Member,Quantity\r\n' + rows.map(function (row) {
          return [row.reward, row.member, row.count].map(function (value) {
            var cell = String(value);
            if (/^[\s]*[=+@-]/.test(cell)) cell = "'" + cell;
            return '"' + cell.replace(/"/g, '""') + '"';
          }).join(',');
        }).join('\r\n');
        var url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' }));
        var link = document.createElement('a'); link.href = url; link.download = 'fortress-rewards.csv'; link.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }
      return;
    } else return;
    save(); render();
  }
  function onChange(event) {
    var target = event.target, member, reward;
    if (target.dataset.site) {
      var site = SITES.find(function (item) { return item.id === target.dataset.site; });
      if (!site) return;
      if (target.checked) {
        if (state.sites.indexOf(site.id) < 0) state.sites.push(site.id);
        var chestId = site.id + '-chests', rewardId = site.id + '-special';
        if (!state.rewards.some(function (r) { return r.id === chestId; }))
          state.rewards.push({ id: chestId, name: site.label + ' chests', quantity: site.id.charAt(0) === 'f' ? 40 : 100, cap: site.id.charAt(0) === 'f' ? 1 : 2 });
        if (!state.rewards.some(function (r) { return r.id === rewardId; }))
          state.rewards.push({ id: rewardId, name: site.label + ' ' + (site.specialName || 'special reward'), quantity: site.amount, cap: site.specialCap || 0 });
      } else {
        state.sites = state.sites.filter(function (value) { return value !== site.id; });
        state.rewards = state.rewards.filter(function (r) { return r.id !== site.id + '-chests' && r.id !== site.id + '-special'; });
        delete state.allocation[site.id + '-chests'];
        delete state.allocation[site.id + '-special'];
      }
    } else if (target.id === 'fr-active-reward') state.activeRewardId = target.value;
    else if (target.dataset.member) {
      member = state.members.find(function (m) { return m.id === target.dataset.member; });
      if (member) {
        if (target.dataset.field === 'name') member.name = target.value.trim().slice(0, 60) || member.name;
        else if (target.dataset.field === 'role') member.role = ['r1', 'r2', 'r3', 'r4', 'r5'].indexOf(target.value) >= 0 ? target.value : 'r1';
        else if (target.dataset.field === 'contribution' && member.role !== 'r4' && member.role !== 'r5') member.contribution = Math.min(4, Math.max(1, integer(target.value)));
        else if (target.dataset.field === 'power') member.power = powerNumber(target.value);
        else if (target.dataset.field === 'excluded') {
          member.excluded = target.checked;
          if (member.excluded) Object.keys(state.allocation).forEach(function (key) { delete state.allocation[key][member.id]; });
        }
      }
    } else if (target.dataset.reward) {
      reward = state.rewards.find(function (r) { return r.id === target.dataset.reward; });
      if (reward) reward[target.dataset.field] = target.dataset.field === 'name' ? (target.value.trim().slice(0, 80) || reward.name) : integer(target.value);
    } else if (target.dataset.cellReward && target.dataset.cellMember) {
      reward = state.rewards.find(function (r) { return r.id === target.dataset.cellReward; });
      member = state.members.find(function (m) { return m.id === target.dataset.cellMember; });
      if (reward && member && !member.excluded) setAssigned(reward, member, target.value);
    } else return;
    save(); render();
  }
  window.FOXFortress = { mount: function (host, accountId) {
    if (!host) return;
    var key = 'fox-fortress-rewards-' + (accountId || 'guest');
    if (root === host && storageKey === key) return;
    if (root) { root.removeEventListener('click', onClick); root.removeEventListener('change', onChange); root.removeEventListener('input', onInput); }
    root = host; storageKey = key; load(); render();
    root.addEventListener('click', onClick); root.addEventListener('change', onChange); root.addEventListener('input', onInput);
  } };
}());
