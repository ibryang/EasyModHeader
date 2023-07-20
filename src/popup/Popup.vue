<script setup lang="ts">
import { sendMessage } from 'webext-bridge/popup';

interface ConfigItemKeyVal {
  key: string
  value: string
}

interface ConfigItem {
  type: 'modifyHeaders' | 'block' | 'redirect'
  name?: string
  list: ConfigItemKeyVal[]
  redirectUrl?: string
}

interface ConfigInfo {
  currentPageUrl: string
  active: number
  list: ConfigItem[]
}

interface RedirectInfo {
  url: string
  redirectUrl: string
}

const redirectInfoList = ref<Array<RedirectInfo>>([])

const modifyHeaderOptions = {
  'modifyHeaders': '修改请求头',
  'block': '拦截请求',
  'redirect': '重定向',
}

// 配置数量
const configCount = ref()
// 当前网址链接
const currentPageUrl = ref()
// 是否可以编辑网址
const isEditPageUrl = ref(false)

// 默认KeyValue
const defaultConfigKeyValueInfo = { key: '', value: '' }

const configInfo = ref<ConfigInfo>({
  currentPageUrl: '',
  active: 0,
  list: [
    {
      type: 'modifyHeaders',
      name: '未定义1',
      list: [defaultConfigKeyValueInfo]
    }
  ]
})

// 获取配置数量, 用于新增配置时自动命名
const getConfigCount = async () => {
  configCount.value = configInfo.value.list.length
}

// 获取Storage数据
const getDataByStorage = async () => {
  let storage = await browser.storage.local.get([currentPageUrl.value]);
  if (storage[currentPageUrl.value]) {
    let jsonData = JSON.parse(storage[currentPageUrl.value])
    configInfo.value = jsonData
  } else {
    await setDefauleConfigInfo()
  }
  if (configInfo.value.list[configInfo.value.active].type === 'redirect') {
    await getGetAllRedirectInfo()
    // console.log("redirectInfoList", redirectInfoList.value);
  }
}

const getGetAllRedirectInfo = async () => {
  let storage = await browser.storage.local.get();
  let redirectList: RedirectInfo[] = []
  for (let key in storage) {
    let val = storage[key]
    if (val) {
      let jsonData: ConfigInfo = JSON.parse(val)
      let list: ConfigItem[] = jsonData.list
      let item: ConfigItem = list[jsonData.active]
      if (item.type === 'redirect') {
        let redirectUrl = item.redirectUrl
        if (redirectUrl) {
          // console.log("redirectUrl", jsonData.currentPageUrl, redirectUrl);
          redirectList.push({ url: jsonData.currentPageUrl, redirectUrl })
        }
      }
    }
  }
  redirectInfoList.value = redirectList
}

const onDeleteRedirect = async (params: any) => {
  await sendMessage('deleteRedirect', params, "background")
  await getGetAllRedirectInfo()
}

getGetAllRedirectInfo()

// 获取当前网址
const getCurrentUrl = async () => {
  let tabs = await browser.tabs.query({ active: true, currentWindow: true })
  const tab = tabs[0]
  if (!tab) return
  if (!tab.url) return
  const url = new URL(tab.url)
  configInfo.value.currentPageUrl = url.host
  currentPageUrl.value = url.host
}

const onSaveConfig = async () => {
  await onChenageConfig(configInfo.value.active)
}

const onSaveConfigAndClose = () => {
  onSaveConfig()
  window.close()
}

// 新增配置 key value
const onAddConfigKeyValue = async () => {
  configInfo.value.list[configInfo.value.active].list.push(defaultConfigKeyValueInfo)
  await onSaveConfig()
}

// 删除配置 key value
const onRemoveConfigKeyValue = (parentIndex: number, index: number) => {
  configInfo.value.list[parentIndex].list.splice(index, 1)
  if (configInfo.value.list[parentIndex].list.length === 0) {
    configInfo.value.list[parentIndex].list.push(defaultConfigKeyValueInfo)
  }
}


// 清空Key Value
const onClearKeyValue = async () => {
  configInfo.value.list[configInfo.value.active].list = [defaultConfigKeyValueInfo]
}

// 初始化数据
const initData = async () => {
  await getCurrentUrl()
  await getDataByStorage()
  await getConfigCount()
}

// 设置默认数据
const setDefauleConfigInfo = async () => {
  configInfo.value = {
    active: 0,
    currentPageUrl: currentPageUrl.value,
    list: [
      {
        type: 'modifyHeaders',
        name: '未定义1',
        list: [defaultConfigKeyValueInfo]
      }
    ]
  }
  configCount.value = 1
}

// 新增配置
const onCreateConfig = async () => {
  configCount.value++
  configInfo.value.list.push({
    "type": "modifyHeaders",
    "name": "未定义" + `${configCount.value}`,
    "list": [defaultConfigKeyValueInfo]
  })
  configInfo.value.active = configInfo.value.list.length - 1
  onSaveConfig()
}


// 删除配置
const onRemoveConfig = async () => {
  console.log(configInfo.value.active);
  if (configInfo.value.list.length <= 1) {
    await setDefauleConfigInfo()
    return
  }
  configInfo.value.list.splice(configInfo.value.active, 1)
  configInfo.value.active = configInfo.value.list.length - 1
  // console.log("popou remove", configInfo.value.list);
  onChenageConfig(configInfo.value.active)
  onSaveConfig()
}

// 切换配置
const onChenageConfig = async (index: number) => {
  configInfo.value.active = index
  await sendMessage('changeConfig', configInfo.value, "background")
  if (configInfo.value.list[configInfo.value.active].type === 'redirect') {
    await getDataByStorage()
    await getGetAllRedirectInfo()
  }
}

initData()
</script>

<template>
  <main flex flex-col all:transition-200 class="w-[500px] h-500px m-8px text-gray-700">
    <!-- 最上面网址 -->
    <div>
      <div flex h-30px b-1px mb-8px p-4px justify-between>
        <div flex items-center>
          <label>网址:
            <span @dblclick="isEditPageUrl = !isEditPageUrl" v-if="!isEditPageUrl">{{ configInfo.currentPageUrl }}</span>
            <input type="text" @focusout="isEditPageUrl = !isEditPageUrl" v-else @keydown="isEditPageUrl = !isEditPageUrl"
              v-model="configInfo.currentPageUrl" />
          </label>
        </div>
        <!-- <div text-blue cursor-pointer @click="onGetCookie">
          导入Cookie
        </div> -->
      </div>
    </div>
    <div flex gap-8px class="h-100%">
      <!-- 右侧 -->
      <div flex-1 flex flex-col b-1px p-4px>
        <!-- 顶部配置 -->
        <div flex items-center gap-8px>
          <div flex items-center gap-4px class="w-50%">
            <!-- 下拉框 -->
            <span>类型:</span>
            <select p-4px flex-1 b-1 v-model="configInfo.list[configInfo.active].type">
              <option v-for="(key, value) in modifyHeaderOptions" :value="value">{{ key }}</option>
            </select>
          </div>
          <div flex-1 flex gap-4px>
            <span>配置名:</span>
            <input min-w-60px flex-1 type="text" v-model="configInfo.list[configInfo.active].name" />
          </div>
        </div>
        <!-- 中部请求头数据 -->
        <div p-4px my-4px h-390px overflow-y-auto bg-gray-100>
          <!-- 修改请求头 -->
          <div flex flex-col v-if="configInfo.list[configInfo.active].type === 'modifyHeaders'">
            <div flex gap-2px b-1px p-2px v-for="(item, index) in configInfo.list[configInfo.active].list">
              <div flex-1 flex flex-col gap-2px>
                <div flex items-center>
                  <span w-50px text-right pr-2px>Key:</span>
                  <input px-4px py-4px flex-1 type="text" b-1 v-model="item.key">
                </div>
                <div flex items-center>
                  <span w-50px text-right pr-2px>Value:</span>
                  <input px-4px py-4px flex-1 type="text" b-1 v-model="item.value">
                </div>
              </div>
              <div flex items-center text-white bg-red hover:bg-red-5 cursor-pointer p-4px
                @click="onRemoveConfigKeyValue(configInfo.active, index)">删除
              </div>
            </div>
          </div>
          <!-- 重定向 -->
          <div p-2px b-1px gap-4px v-if="configInfo.list[configInfo.active].type === 'redirect'">
            <div b-1px p-2px flex items-center>
              <span>重定向到: </span>
              <input type="text" b-1px px-4px py-4px flex-1 v-model="configInfo.list[configInfo.active].redirectUrl">
            </div>
            <div v-if="redirectInfoList.length > 0">
              <div flex gap-4px items-center>
                <hr flex-1 b-gray-4 />
                <div>这是一条华丽的分割线!</div>
                <hr flex-1 b-gray-4 />
              </div>
              <div b-1px p-2px>
                <div bg-gray-200>
                  <span>设置重定向的网站如下</span>
                </div>
                <div b-1px p-4px flex items-center gap-4px v-for="item in redirectInfoList">
                  <div flex-1 flex gap-4px items-center justify-between>
                    <div b-1px flex-1>
                      <div flex gap-4px>
                        <span>原链接: </span>
                        <input flex-1 type="text" disabled :value="item.url" />
                      </div>
                      <hr>
                      <div flex gap-4px>
                        <span>定向到: </span>
                        <input flex-1 type="text" disabled :value="item.redirectUrl" />
                      </div>
                    </div>
                    <div flex items-center text-white bg-red hover:bg-red-5 cursor-pointer p-4px
                      @click="onDeleteRedirect(item)">删除</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
          <div p-2px gap-4px v-if="configInfo.list[configInfo.active].type === 'block'">
            <div flex items-center>
              <span>当确定拦截当前链接时, 请点击一下保存</span>
            </div>
          </div>
        </div>
        <!-- 底部操作 -->
        <div flex-1 flex gap-4px>
          <button class="w-50%" @click="onAddConfigKeyValue" bg-green hover:bg-green-5 p-4px text-white>新增请求头</button>
          <button class="w-50%" @click="onClearKeyValue" bg-red hover:bg-red-5 p-4px text-white>清空</button>
          <button class="w-50%" @click="onSaveConfig" bg-blue hover:bg-blue-5 p-4px text-white>保存配置</button>
          <button class="w-50%" @click="onSaveConfigAndClose" bg-orange hover:bg-orange-5 p-4px text-white>保存并关闭</button>
        </div>
      </div>
      <!-- 左侧 -->
      <div w-140px b-1px p-4px flex flex-col>
        <div flex-1>
          <div px-8px py-2px b-1px text-white :class="configInfo.active == index ? 'bg-blue hover:bg-blue-5' : 'bg-gray'"
            cursor-pointer v-for="(item, index) in configInfo.list" @click="onChenageConfig(index)">
            {{ item.name }}
          </div>
        </div>
        <div gap-x-4px flex text-center>
          <span bg-green hover:bg-green-5 text-white class="w-50% p-[4.5px]" @click="onCreateConfig" cursor-pointer>
            新增
          </span>
          <span bg-red hover:bg-red-5 text-white class="w-50% p-[4.5px]" @click="onRemoveConfig" cursor-pointer>
            删除
          </span>
        </div>
      </div>
    </div>

  </main>
</template>
