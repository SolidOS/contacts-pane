# contacts-pane

SolidOS pane that displays a personal contact and address books.

![CI](https://github.com/solid/contacts-pane/workflows/CI/badge.svg)

## Contribute

### Tech stack

- JavaScript
- Jest
- Eslint
- SolidOS

### Tests

To run all tests:
```shell script
npm test
```

If you are a first time developer/user on Windows 10, the repository may give package issues regarding webpack or jest.
If this is the case, simply run "npm audit fix" and upgrade the repository. It should work fine.

#### Unit tests

Unit tests use `jest` and are placed in the `test` folder.

### Dev Server

Start a webpack dev server:

```shell script
npm start
```

Visit `http://localhost:8080/` to render the pane. Adjust `const webIdToShow` in `./dev/index.ts` to show a different profile.
 
### Build

```
npm run build
```

