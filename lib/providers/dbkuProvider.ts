import { MacCmsHtmlProvider, MacCmsConfig } from './macCmsProvider';

/**
 * DuBoKu (独播库) Provider implementation based on MacCmsHtmlProvider
 */
export class DbkuProvider extends MacCmsHtmlProvider {
  constructor(config?: Partial<MacCmsConfig>) {
    super({
      key: 'dbku',
      name: '独播库',
      baseUrl: 'https://www.dbku.tv',
      searchPath: '/vodsearch/-------------.html?wd=',
      ...config,
    });
  }
}
