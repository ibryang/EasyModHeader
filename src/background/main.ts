import { onMessage } from 'webext-bridge/background'
import { DeclarativeNetRequest } from 'webextension-polyfill'

// only on dev mode
if (import.meta.hot) {
  // @ts-expect-error for background HMR
  import('/@vite/client')
  // load latest content script
  import('./contentScriptHMR')
}

// 监听来自content script的消息，根据消息内容修改请求头
onMessage("changeConfig", async (message: any) => {
  const { currentPageUrl, active, list } = message.data
  const activeData = list[active]
  const type = activeData.type
  const listFilter = activeData.list.filter((item: any) => item.key !== '')
  if (type === 'redirect') {
    // 添加规则
    const ruleId = await getRoleIdByDomain(currentPageUrl) || await getRoleIdByLastRoleId()
    const rule: DeclarativeNetRequest.Rule = {
      id: ruleId,
      priority: 1,
      action: {
        type: type,
        redirect: {
          url: activeData.redirectUrl
        }
      },
      condition: {
        regexFilter: currentPageUrl,
        resourceTypes: [
          "main_frame",
          "xmlhttprequest"
        ]
      }
    };
    await updateRules(rule, ruleId)
    // 存储配置
    await setStore(currentPageUrl, JSON.stringify(message.data))
  } else if (type === 'block') {
    // 添加规则
    const ruleId = await getRoleIdByDomain(currentPageUrl) || await getRoleIdByLastRoleId()
    const rule: DeclarativeNetRequest.Rule = {
      id: ruleId,
      priority: 1,
      action: {
        type: type,
      },
      condition: {
        regexFilter: currentPageUrl,
        resourceTypes: [
          "main_frame",
          "xmlhttprequest"
        ]
      }
    };
    await updateRules(rule, ruleId)
    // 存储配置
    await setStore(currentPageUrl, JSON.stringify(message.data))
  } else {
    if (list.length === 0) {
      return 
    }
    // 添加规则
    const ruleId = await getRoleIdByDomain(currentPageUrl) || await getRoleIdByLastRoleId()
    const requestHeaders = listFilter.map((item: any) => ({
      "header": item.key,
      "operation": "set",
      "value": item.value
    }))
    const rule: DeclarativeNetRequest.Rule = {
      id: ruleId,
      priority: 1,
      action: {
        type: type,
        requestHeaders: requestHeaders
      },
      condition: {
        regexFilter: currentPageUrl,
        resourceTypes: [
          "xmlhttprequest",
          "main_frame",
        ]
      }
    };
    await updateRules(rule, ruleId)
    // 存储配置
    await setStore(currentPageUrl, JSON.stringify(message.data))
  }
})

onMessage("deleteRedirect", async (message: any) => {
  const { url } = message.data
  let data = await getStore(url)
  if (data[url]) {
    data = JSON.parse(data[url])
    console.log(data);
    // 删除规则
    const ruleId = await getRoleIdByDomain(url)
    if (ruleId) {
      await deleteRule(ruleId)
    }
    // 删除存储的配置
    // 删除data.active
    data.list[data.active].type = 'modifyHeaders'
    data.list[data.active].redirectUrl = ""
    await setStore(data.currentPageUrl, JSON.stringify(data))
  }
})

// 存储配置
async function setStore(key: string, value: any) {
  await browser.storage.local.set({ [key]: value });
}

// 获取存储的配置
async function getStore(key: string) {
  return await browser.storage.local.get([key]);
}

// 删除存储的配置
async function removeStore(key: string) {
  await browser.storage.local.remove([key]);
}

// 更新规则
async function updateRules(rule: DeclarativeNetRequest.Rule, oldRuleId: number | undefined = undefined) {
  if (oldRuleId) {
    await deleteRule(oldRuleId)
  }
  if (rule?.action?.requestHeaders?.length === 0) {
    return 
  }
  await browser.declarativeNetRequest.updateDynamicRules({
    addRules: [rule]
  });
}

// 删除规则
async function deleteRule(ruleId: number) {
  await browser.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [ruleId] });
}

// 获取所有规则
async function getRules() {
  return await browser.declarativeNetRequest.getDynamicRules();
}

// 获取最后一个规则的id
async function getRoleIdByLastRoleId() {
  const rules = await getRules();
  const lastRule = rules[rules.length - 1];
  return lastRule ? lastRule.id + 1 : 1
}

// 根据域名获取规则id
async function getRoleIdByDomain(domain: string) {
  const rules = await getRules();
  for (const rule of rules) {
    if (rule.condition.regexFilter?.indexOf(domain) !== -1) {
      return rule.id;
    }
  }
}

// 获取所有存储的配置
async function getRulesFromStorage() {
  return await browser.storage.local.get();
}
