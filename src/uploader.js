import React, {
  useEffect,
  useRef,
  useCallback,
  useImperativeHandle
} from 'react'
import uploadcare from 'uploadcare-widget'

import {
  useEventCallback,
  useCustomTabs,
  useValidators,
  useDeepMemo,
  useDeepEffect
} from './hooks'

function camelCaseToDash(str) {
  return str.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase()
}

const propsToAttr = (props) =>
  Object.entries(props).reduce(
    (attr, [key, value]) => ({
      ...attr,
      [`data-${camelCaseToDash(key)}`]: value
    }),
    {}
  )

const useWidget = (
  {
    id,
    name,
    value,
    onFileSelect,
    onChange,
    onDialogOpen,
    onDialogClose,
    onTabChange,
    apiRef,
    customTabs,
    validators,
    tabsCss,
    locale,
    localeTranslations,
    localePluralize,
    previewUrlCallback,
    ...options
  },
  uploadcare
) => {
  const input = useRef(null)
  const widget = useRef(null)
  const cachedValueRef = useRef(null)

  const fileSelectedCallback = useEventCallback(onFileSelect)
  const changeCallback = useEventCallback(onChange)
  const dialogOpenCallback = useEventCallback(onDialogOpen)
  const dialogCloseCallback = useEventCallback(onDialogClose)
  const tabChangeCallback = useEventCallback(onTabChange)

  useCustomTabs(customTabs, uploadcare)

  const attributes = useDeepMemo(() => propsToAttr(options), [options])

  useDeepEffect(() => {
    if (locale) window.UPLOADCARE_LOCALE = locale
    if (localePluralize) window.UPLOADCARE_LOCALE_PLURALIZE = localePluralize
    if (localeTranslations) {
      window.UPLOADCARE_LOCALE_TRANSLATIONS = localeTranslations
    }
    if (previewUrlCallback) {
      window.UPLOADCARE_PREVIEW_URL_CALLBACK = previewUrlCallback
    }

    uploadcare.plugin((internal) => {
      internal.locale.rebuild({
        locale: locale || null,
        localeTranslations: localeTranslations || null,
        localePluralize: localePluralize || null
      })
    })

    return () => {
      if (locale) delete window.UPLOADCARE_LOCALE
      if (localePluralize) delete window.UPLOADCARE_LOCALE_PLURALIZE
      if (localeTranslations) delete window.UPLOADCARE_LOCALE_TRANSLATIONS
      if (previewUrlCallback) delete window.UPLOADCARE_PREVIEW_URL_CALLBACK
    }
  }, [locale, localeTranslations, localePluralize, previewUrlCallback])

  useEffect(() => {
    const inputEl = input.current
    widget.current = uploadcare.Widget(inputEl)
    const widgetElement = inputEl.nextSibling
    if (cachedValueRef.current) {
      // restore widget value when called twice in React.StrictMode
      widget.current.value(cachedValueRef.current)
    }

    return () => {
      // useEffect could be called twice inside React.StrictMode
      // to reinitialize widget on the same input element, we need to cleanup bounded jquery data on it
      // `uploadcareWidget` is a data attr that is used to store widget api
      // see https://github.com/uploadcare/uploadcare-widget/blob/feat/unsplash-tab/src/widget/live.js#L11
      uploadcare.jQuery(inputEl).removeData('uploadcareWidget')
      widgetElement && widgetElement.remove()
    }
  }, [uploadcare, attributes])

  useValidators(widget, validators)

  useEffect(() => {
    widget.current.onUploadComplete.add(changeCallback)
    widget.current.onChange.add(fileSelectedCallback)

    return () => {
      widget.current.onUploadComplete.remove(changeCallback)
      widget.current.onChange.remove(fileSelectedCallback)
    }
  }, [changeCallback, fileSelectedCallback, uploadcare, attributes])

  useEffect(() => {
    let dialog
    const saveDialog = (ref) => {
      dialog = ref
      dialog
        .done(dialogCloseCallback)
        .fail(dialogCloseCallback)
        .progress(tabChangeCallback)

      dialogOpenCallback(ref)
    }

    widget.current.onDialogOpen.add(saveDialog)

    return () => {
      widget.current.onDialogOpen.remove(saveDialog)
      dialog && dialog.reject()
    }
  }, [attributes, dialogCloseCallback, dialogOpenCallback, tabChangeCallback])

  useEffect(() => {
    let files = []
    const saveFiles = (file) => {
      if (file) {
        files = file.files ? file.files() : [file]
      } else {
        files = []
      }
    }

    widget.current.onChange.add(saveFiles)

    return () => {
      files.forEach((file) => file.cancel())
      widget.current.onChange.remove(saveFiles)
    }
  }, [attributes])

  useEffect(() => {
    if (cachedValueRef.current !== value) {
      widget.current.value(value)
    }
    cachedValueRef.current = value
  }, [value])

  useEffect(() => {
    if (uploadcare && tabsCss && typeof tabsCss === 'string') {
      if (tabsCss.indexOf('https://') === 0) {
        uploadcare.tabsCss.addUrl(tabsCss)
      } else {
        uploadcare.tabsCss.addStyle(tabsCss)
      }
    }
  }, [uploadcare, tabsCss])

  useImperativeHandle(
    apiRef,
    () => ({
      openDialog: () => widget.current.openDialog(),
      reloadInfo: () => widget.current.reloadInfo(),
      getInput: () => widget.current.inputElement,
      value: (value) => widget.current.value(value)
    }),
    []
  )

  return useCallback(
    () => (
      <input type="hidden" ref={input} id={id} name={name} {...attributes} />
    ),
    [attributes, id, name]
  )
}

const Uploader = (props) => {
  const Input = useWidget(props, uploadcare)

  return <Input />
}

export default Uploader
